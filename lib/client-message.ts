import { ClientMessageMetadata, ClientMessageSender } from './types/message.types';

export class ClientMessage {
  public readonly id: string;
  public readonly event: string;
  public readonly body: any;
  public readonly timestamp: number;
  public readonly sender: ClientMessageSender;
  public readonly metadata?: ClientMessageMetadata;

  constructor(message: ClientMessage) {
    this.id = message.id;
    this.event = message.event;
    this.body = message.body;
    this.timestamp = message.timestamp;
    this.sender = message.sender;
    this.metadata = message.metadata;
  }

  delete() {
    console.log('delete', this.id);
  }

  edit(body: any) {
    console.log('edit', this.id);
  }
}
