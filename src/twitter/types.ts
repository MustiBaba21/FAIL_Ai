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