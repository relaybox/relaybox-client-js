import { AuthUserPublic } from './auth.types';

export interface ClientMessageMetadata {
  humanMessage?: boolean;
  llmModel?: string;
  direct?: boolean;
}

export interface ClientMessageSender {
  clientId: string;
  connectionId: string;
  user?: AuthUserPublic;
}
