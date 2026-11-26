import type { MediaUploadTicket } from '@marketpilot/contracts';
import { MediaStoragePort, type StoredImage, type StoredVideo } from './media-storage.port';

// Used when no storage is configured: uploads are off and no URL counts as ours.
export class UnavailableMediaStorage extends MediaStoragePort {
  isAvailable(): boolean {
    return false;
  }

  createUploadTicket(): MediaUploadTicket {
    throw new Error('Media storage is not configured');
  }

  ownsUrl(): boolean {
    return false;
  }

  uploadImage(): Promise<StoredImage> {
    return Promise.reject(new Error('Media storage is not configured'));
  }

  uploadVideo(): Promise<StoredVideo> {
    return Promise.reject(new Error('Media storage is not configured'));
  }
}
