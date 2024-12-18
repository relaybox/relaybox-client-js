import { logger } from './logger';
import { defaultHeaders, serviceRequest } from './request';
import { HttpMethod, HttpMode } from './types';
import { ClientMessageMetadata, ClientMessageSender } from './types/message.types';

export class ClientMessage {
  public readonly id: string;
  public readonly event: string;
  public readonly body: any;
  public readonly timestamp: number;
  public readonly sender: ClientMessageSender;
  public readonly metadata?: ClientMessageMetadata;
  private readonly stateServiceUrl: string;

  constructor(message: ClientMessage, stateServiceUrl: string) {
    this.id = message.id;
    this.event = message.event;
    this.body = message.body;
    this.timestamp = message.timestamp;
    this.sender = message.sender;
    this.metadata = message.metadata;
    this.stateServiceUrl = stateServiceUrl;
  }

  async delete() {
    logger.logInfo(`Deleting message ${this.id}`);

    try {
      // const authToken = this.getAuthToken();
      // if (!authToken) {
      //   throw new Error('No auth token found');
      // }
      // const requestParams: RequestInit = {
      //   method: HttpMethod.PUT,
      //   mode: HttpMode.CORS,
      //   headers: {
      //     ...defaultHeaders,
      //     Authorization: `Bearer ${authToken}`
      //   }
      // };
      // const requestUrl = `${this.stateServiceUrl}/messages/${this.id}`;
      // const response = await serviceRequest<any>(requestUrl, requestParams);
    } catch (err: unknown) {
      logger.logError(`Failed to delete message ${this.id}`);
      throw err;
    }
  }
}
