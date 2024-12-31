import { Client } from 'twitter-api-sdk';
import { TwitterApi } from 'twitter-api-v2';
import { SolanaAgentKit } from '../agent';
import { TwitterConfig, TwitterResponse } from './types';
import OpenAI from 'openai';

export class TwitterBot {
  private client: Client;
  private twitterApi: TwitterApi;
  private openai: OpenAI;
  private solanaAgent: SolanaAgentKit;

  constructor(config: TwitterConfig, solanaAgent: SolanaAgentKit) {
    this.client = new Client(config.bearerToken);
    this.twitterApi = new TwitterApi({
      appKey: config.apiKey,
      appSecret: config.apiSecret,
      accessToken: config.accessToken,
      accessSecret: config.accessTokenSecret,
    });
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
      const rules = await this.client.tweets.getRules();
      
      // Clean up existing rules
      if (rules.data?.length) {
        await this.client.tweets.deleteRules({
          ids: rules.data.map(rule => rule.id)
        });
      }

      // Add rule to track mentions
      await this.client.tweets.addRules({
        add: [{ value: `@${await this.twitterApi.v2.me().then(response => response.data.username)}` }]
      });

      // Start streaming
      const stream = await this.client.tweets.searchStream({
        'tweet.fields': ['author_id', 'conversation_id', 'created_at', 'text'],
        expansions: ['author_id']
      });

      for await (const tweet of stream) {
        if (tweet.data) {
          await this.respondToMention(tweet.data.id, tweet.data.text);
        }
      }
    } catch (error) {
      console.error('Error in mentions stream:', error);
      // Attempt to restart the stream after a delay
      setTimeout(() => this.startStreamingMentions(), 30000);
    }
  }
}