export interface TwitterConfig {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
    bearerToken: string;
  }
  
  export interface TwitterResponse {
    success: boolean;
    message: string;
    tweetId?: string;
    error?: string;
  }