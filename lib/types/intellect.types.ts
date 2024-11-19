export interface IntellectResponse {
  response: string;
  conversationId: string;
}

export interface IntellectQueryOptions {
  conversationId?: string;
  assetId?: string;
  streaming?: boolean;
}
