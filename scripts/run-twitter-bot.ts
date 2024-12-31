import { SolanaAgentKit } from '../src/agent/index';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
    // Validate required environment variables
    const requiredEnvVars = [
        'SOLANA_PRIVATE_KEY',
        'TWITTER_CLIENT_ID',
        'TWITTER_CLIENT_SECRET',
        'TWITTER_ACCESS_TOKEN',
        'TWITTER_ACCESS_TOKEN_SECRET',
        'TWITTER_BEARER_TOKEN',
        'OPENAI_API_KEY'
    ];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required environment variable: ${envVar}`);
        }
    }

    // Initialize SolanaAgentKit with Twitter configuration
    const agent = new SolanaAgentKit(
        process.env.SOLANA_PRIVATE_KEY!,
        process.env.RPC_URL || "https://api.mainnet-beta.solana.com",
        process.env.OPENAI_API_KEY!,
        {
            clientId: process.env.TWITTER_CLIENT_ID!,
            clientSecret: process.env.TWITTER_CLIENT_SECRET!,
            accessToken: process.env.TWITTER_ACCESS_TOKEN!,
            accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!, // Added this
            bearerToken: process.env.TWITTER_BEARER_TOKEN!              // Added this
        }
    );

    console.log('Starting Twitter bot...');
    
    try {
        await agent.startTwitterBot();
        console.log('Twitter bot is running and listening for mentions...');
    } catch (error) {
        console.error('Error starting Twitter bot:', error);
    }
}

// Run the bot
main().catch(console.error);