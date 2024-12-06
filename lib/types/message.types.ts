import { AuthUserPublic } from './auth.types';

export interface ClientMessageMetadata {
  humanMessage?: boolean;
  llmModel?: string;
}

export interface ClientMessage {
  id: string;
  body: any;
  sender: {
    clientId: string;
    connectionId: string;
    user?: AuthUserPublic;
  };
  timestamp: number;
  event?: string;
  metadata?: ClientMessageMetadata;
}
