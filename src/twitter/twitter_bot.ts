import { TwitterApi } from 'twitter-api-v2';
import { SolanaAgentKit } from '../agent';
import OpenAI from 'openai';

export interface TwitterConfig {
    clientId: string;          // OAuth 2.0 Client ID
    clientSecret: string;      // OAuth 2.0 Client Secret
    accessToken: string;       // OAuth 2.0 Access Token
    accessTokenSecret: string; // OAuth 2.0 Access Token Secret
    bearerToken: string;       // Bearer Token
}

export interface TwitterResponse {
    success: boolean;
    message: string;
    tweetId?: string;
    error?: string;
}

export class TwitterBot {
    private twitterApi: TwitterApi;
    private appOnlyClient: TwitterApi;
    private openai: OpenAI;
    private solanaAgent: SolanaAgentKit;
    private config: TwitterConfig;

    constructor(config: TwitterConfig, solanaAgent: SolanaAgentKit) {
        this.config = config;
        
        // Initialize with OAuth 2.0
        this.twitterApi = new TwitterApi(config.accessToken);  // Just pass the access token directly
        
        this.appOnlyClient = this.twitterApi;
        this.solanaAgent = solanaAgent;
    
        if (!solanaAgent.openai_api_key) {
            throw new Error('OpenAI API key is required for tweet analysis');
        }
    
        this.openai = new OpenAI({
            apiKey: solanaAgent.openai_api_key
        });
    }

    private async analyzeTweet(tweetText: string): Promise<string> {
        const response = await this.openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are an AI assistant analyzing tweets to generate appropriate responses. Focus on blockchain and Solana-related content."
                },
                {
                    role: "user",
                    content: `Analyze this tweet and suggest a response: ${tweetText}`
                }
            ]
        });

        return response.choices[0].message.content || '';
    }

    private async generateResponse(analysis: string): Promise<string> {
        const response = await this.openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "Generate a concise, friendly tweet response (max 280 characters) based on the analysis provided."
                },
                {
                    role: "user",
                    content: analysis
                }
            ]
        });

        return response.choices[0].message.content || '';
    }

    async respondToMention(tweetId: string, mentionText: string): Promise<TwitterResponse> {
        try {
            // Analyze the tweet content
            const analysis = await this.analyzeTweet(mentionText);
        
            // Generate appropriate response
            const response = await this.generateResponse(analysis);
        
            // Post the response as a reply
            const tweet = await this.twitterApi.v2.reply(
                response.slice(0, 280), // Ensure we stay within Twitter's character limit
                tweetId
            );

            return {
                success: true,
                message: 'Successfully replied to tweet',
                tweetId: tweet.data.id
            };
        } catch (error) {
            console.error('Error responding to mention:', error);
            return {
                success: false,
                message: 'Failed to respond to mention',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async startStreamingMentions(): Promise<void> {
        try {
            // Initialize app-only client with bearer token
            this.appOnlyClient = new TwitterApi(this.config.bearerToken);

            // Fetch existing rules
            const rules = await this.appOnlyClient.v2.streamRules();
            
            // Clean up existing rules
            if (rules.data?.length) {
                await this.appOnlyClient.v2.updateStreamRules({
                    delete: { ids: rules.data.map(rule => rule.id) }
                });
            }

            // Get user information using the user authentication
            const me = await this.twitterApi.v2.me();
            
            // Add rule to track mentions using app-only client
            await this.appOnlyClient.v2.updateStreamRules({
                add: [{ value: `@${me.data.username}` }]
            });

            // Start streaming with app-only client
            const stream = await this.appOnlyClient.v2.searchStream({
                'tweet.fields': ['author_id', 'conversation_id', 'created_at', 'text'],
                expansions: ['author_id']
            });

            console.log('Started streaming mentions...');

            stream.on('data', async tweet => {
                if (tweet.data) {
                    await this.respondToMention(tweet.data.id, tweet.data.text);
                }
            });

            stream.on('error', error => {
                console.error('Stream error:', error);
                setTimeout(() => this.startStreamingMentions(), 30000);
            });

        } catch (error) {
            console.error('Error in mentions stream:', error);
            setTimeout(() => this.startStreamingMentions(), 30000);
        }
    }
}