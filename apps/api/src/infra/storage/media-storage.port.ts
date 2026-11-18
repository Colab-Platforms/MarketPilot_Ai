import type { MediaUploadTicket } from '@marketpilot/contracts';

// Owner-uploaded media (ADR 0006). The browser uploads straight to the provider with a
// short-lived ticket; we only ever store the resulting public URL.
export abstract class MediaStoragePort {
  abstract isAvailable(): boolean;
  // `folder` is a path such as "marketpilot_products/<workspaceId>".
  abstract createUploadTicket(folder: string): MediaUploadTicket;
  // True only for URLs this storage issued under `folder`, so a client cannot attach
  // arbitrary links as if they were uploads.
  abstract ownsUrl(url: string, folder: string): boolean;
}
