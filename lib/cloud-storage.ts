import EventEmitter from 'eventemitter3';
import { logger } from './logger';
import { HttpMethod, PaginatedRequestOptions, PaginatedResponse } from './types';
import { serviceRequest } from './request';
import { CloudStorageAsset } from './types/cloud-storage.types';

const STORAGE_ROOMS_PATHNAME = 'rooms';
const STORAGE_ASSETS_PATHNAME = 'assets';
const STORAGE_ASSETS_METATDATA_PREFIX = 'metadata';

export class CloudStorage extends EventEmitter {
  constructor(
    private readonly roomId: string,
    private readonly storageServiceUrl: string,
    private readonly getAuthToken: () => string | null
  ) {
    super();
  }

  /**
   * Pass a `FileList` to upload a file or files to the cloud storage service.
   *
   * @param {FileList} files - Files to be uploaded
   * @returns {CloudStorageAsset} - A promise that resolves to the metadata of the uploaded cloud storage asset.
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
   * Returns a paginated list of assets uplaoded to the room.
   * Options:
   * offset: number
   * limit: number
   *
   * @param {PaginatedRequestOptions} options - Paginated list request optiions
   * @returns {PaginatedResponse<CloudStorageAsset>} - A promise that resolves to paginated list of assets.
   */
  async list({ offset = 0, limit = 10 }: PaginatedRequestOptions = {}): Promise<
    PaginatedResponse<CloudStorageAsset>
  > {
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

      const queryParams = {
        offset: offset.toString(),
        limit: limit.toString()
      };

      const queryString = new URLSearchParams(queryParams).toString();

      const url = `${this.storageServiceUrl}/${STORAGE_ASSETS_PATHNAME}/${STORAGE_ROOMS_PATHNAME}/${this.roomId}?${queryString}`;

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

  /**
   * Retrieves metadata for a cloud storage asset by its ID.
   *
   * @param {string} assetId - The unique identifier of the asset to retrieve.
   * @returns {Promise<CloudStorageAsset>} - A promise that resolves to the metadata of the requested cloud storage asset.
   * @throws {Error} - Throws an error if the authentication token is missing or if the request fails.
   */
  async getMetadata(assetId: string): Promise<CloudStorageAsset> {
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

      const url = `${this.storageServiceUrl}/${STORAGE_ASSETS_PATHNAME}/${assetId}/${STORAGE_ASSETS_METATDATA_PREFIX}`;

      const response = await serviceRequest<CloudStorageAsset>(url, requestParams);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  /**
   * Helper function to retrieve the URL of a cloud storage asset by its ID.
   *
   * @param assetId The unique identifier of the asset to retrieve.
   * @returns The URL of the asset.
   */
  getUrl(assetId: string): string {
    return `${
      this.storageServiceUrl
    }/${STORAGE_ASSETS_PATHNAME}/${assetId}?token=${this.getAuthToken()}`;
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
