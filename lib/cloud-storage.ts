import EventEmitter from 'eventemitter3';
import { logger } from './logger';
import { HttpMethod, PaginatedResponse } from './types';
import { serviceRequest } from './request';
import { CloudStorageAsset } from './types/cloud-storage.types';

const STORAGE_ROOMS_PATHNAME = 'rooms';
const STORAGE_ASSETS_PATHNAME = 'assets';

export class CloudStorage extends EventEmitter {
  constructor(
    private readonly roomId: string,
    private readonly storageServiceUrl: string,
    private readonly getAuthToken: () => string | null
  ) {
    super();
  }

  /**
   * Create and dispatch a new Intellect service query.
   * Include optional params to refine results
   *
   * @param {FileList} files - Files to be uploaded
   * @returns {CloudStorageAsset}
   */
  async put(files: FileList): Promise<CloudStorageAsset> {
    logger.logInfo(`Running put assets request`);

    try {
      const authToken = this.getAuthToken();

      if (!authToken) {
        throw new Error('No auth token found');
      }

      const formData = this.getFormData(files);

      const requestParams: RequestInit = {
        method: HttpMethod.POST,
        body: formData,
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      };

      const url = `${this.storageServiceUrl}/${STORAGE_ASSETS_PATHNAME}/${STORAGE_ROOMS_PATHNAME}/${this.roomId}`;

      const response = await serviceRequest<CloudStorageAsset>(url, requestParams);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  /**
   * Create and dispatch a new Intellect service query.
   * Include optional params to refine results
   *
   * @returns {PaginatedResponse<CloudStorageAsset>}
   */
  async list(): Promise<PaginatedResponse<CloudStorageAsset>> {
    logger.logInfo(`Running get assets request`);

    try {
      const authToken = this.getAuthToken();

      if (!authToken) {
        throw new Error('No auth token found');
      }

      const requestParams: RequestInit = {
        method: HttpMethod.GET,
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      };

      const url = `${this.storageServiceUrl}/${STORAGE_ASSETS_PATHNAME}/${STORAGE_ROOMS_PATHNAME}/${this.roomId}`;

      const response = await serviceRequest<PaginatedResponse<CloudStorageAsset>>(
        url,
        requestParams
      );

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  async get(assetId: string): Promise<CloudStorageAsset> {
    logger.logInfo(`Running get asset request`);

    try {
      const authToken = this.getAuthToken();

      if (!authToken) {
        throw new Error('No auth token found');
      }

      const requestParams: RequestInit = {
        method: HttpMethod.GET,
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      };

      const url = `${this.storageServiceUrl}/${STORAGE_ASSETS_PATHNAME}/${assetId}`;

      const response = await serviceRequest<CloudStorageAsset>(url, requestParams);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  private getFormData(files: FileList): FormData {
    try {
      const formData = new FormData();

      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });

      return formData;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }
}
