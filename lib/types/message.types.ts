export interface ClientMessage {
  body: any;
  sender: {
    clientId: string;
    connectionId: string;
  };
  timestamp: number;
}
