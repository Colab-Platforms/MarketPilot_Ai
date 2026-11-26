import type { MediaUploadTicket } from '@marketpilot/contracts';

export type MediaKind = 'image' | 'video';

export interface StoredImage {
  url: string;
  width: number | null;
  height: number | null;
}

// Owner-uploaded and generated media (ADR 0006). The browser uploads straight to the provider
// with a short-lived ticket; generated images are uploaded by the server. We only ever store
// the resulting public URL.
export abstract class MediaStoragePort {
  abstract isAvailable(): boolean;
  // `folder` is a path such as "marketpilot_products/<workspaceId>".
  abstract createUploadTicket(folder: string, kind?: MediaKind): MediaUploadTicket;
  // True only for URLs this storage issued under `folder` for that kind of file, so a client
  // cannot attach arbitrary links as if they were uploads.
  abstract ownsUrl(url: string, folder: string, kind?: MediaKind): boolean;
  abstract uploadImage(bytes: Buffer, mediaType: string, folder: string): Promise<StoredImage>;
  // Copies a finished video from a provider. A URL without headers is fetched by storage
  // itself; one that needs credentials is downloaded by us first, within a size limit.
  // Bytes are for videos we made ourselves, such as an assembled reel.
  abstract uploadVideo(source: VideoSource, folder: string): Promise<StoredVideo>;
}

export type VideoSource = { url: string; headers: Record<string, string> | null } | { bytes: Buffer };

export interface StoredVideo extends StoredImage {
  durationSeconds: number | null;
}
