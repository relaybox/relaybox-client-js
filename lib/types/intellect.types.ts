export interface IntellectResponse {
  response: string;
  conversationId: string;
}

export interface IntellectQueryOptions {
  conversationId?: string;
  assetId?: string;
  streaming?: boolean;
}

export interface IntellectPublishOptions {
  inputPath: string;
  conversationId?: string;
  assetId?: string;
  llm?: string;
}

export interface IntellectOptions {
  model?: string;
  prompt?: string;
  temperature?: number;
}

export enum IntellectActionType {
  INITIALIZED = 'initialized',
  PROCESSING = 'processing',
  WEB_SEARCH = 'webSearch'
}

export interface IntellectSystemMessage {
  correlationId: string;
  model: string | null;
  action: IntellectActionType;
  data?: any;
}
