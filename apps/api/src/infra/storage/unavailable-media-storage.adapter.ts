import type { MediaUploadTicket } from '@marketpilot/contracts';
import { MediaStoragePort } from './media-storage.port';

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
}
