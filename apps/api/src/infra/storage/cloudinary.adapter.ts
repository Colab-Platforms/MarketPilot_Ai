import { createHash } from 'node:crypto';
import type { MediaUploadTicket } from '@marketpilot/contracts';
import {
  MediaStoragePort,
  type MediaKind,
  type StoredImage,
  type StoredVideo,
  type VideoSource,
} from './media-storage.port';

// Cloudinary honours a signature for one hour from its timestamp.
const TICKET_TTL_MS = 60 * 60 * 1000;
const ALLOWED_FORMATS: Record<MediaKind, string> = { image: 'jpg,jpeg,png,webp', video: 'mp4,mov,webm' };

interface Credentials {
  apiKey: string;
  apiSecret: string;
  cloudName: string;
}

export function parseCloudinaryUrl(raw: string): Credentials {
  const url = new URL(raw);
  if (url.protocol !== 'cloudinary:' || !url.username || !url.password || !url.hostname) {
    throw new Error('CLOUDINARY_URL must look like cloudinary://<api_key>:<api_secret>@<cloud_name>');
  }
  return {
    apiKey: decodeURIComponent(url.username),
    apiSecret: decodeURIComponent(url.password),
    cloudName: url.hostname,
  };
}

// Signed direct upload over the REST API, no SDK: sort the signed params, join as
// name=value with "&", append the API secret, SHA-1 hex.
export function signParams(params: Record<string, string>, apiSecret: string): string {
  const payload = Object.keys(params)
    .sort()
    .map((name) => `${name}=${params[name]}`)
    .join('&');
  return createHash('sha1').update(payload + apiSecret).digest('hex');
}

export class CloudinaryAdapter extends MediaStoragePort {
  private readonly credentials: Credentials;

  constructor(cloudinaryUrl: string, private readonly now: () => number = Date.now) {
    super();
    this.credentials = parseCloudinaryUrl(cloudinaryUrl);
  }

  isAvailable(): boolean {
    return true;
  }

  createUploadTicket(folder: string, kind: MediaKind = 'image'): MediaUploadTicket {
    const issuedAt = this.now();
    // `folder` places the asset and prefixes its public id in both fixed and dynamic folder
    // mode, which is what lets ownsUrl check the delivery path.
    const signed = { allowed_formats: ALLOWED_FORMATS[kind], folder, timestamp: String(Math.floor(issuedAt / 1000)) };
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.credentials.cloudName}/${kind}/upload`,
      fields: { ...signed, api_key: this.credentials.apiKey, signature: signParams(signed, this.credentials.apiSecret) },
      urlField: 'secure_url',
      expiresAt: new Date(issuedAt + TICKET_TTL_MS).toISOString(),
    };
  }

  ownsUrl(url: string, folder: string, kind: MediaKind = 'image'): boolean {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') return false;
    const base = `/${this.credentials.cloudName}/${kind}/upload/`;
    if (!parsed.pathname.startsWith(base)) return false;
    // Delivery paths are [transformations/][v<version>/]<public_id>.<ext>.
    const rest = parsed.pathname.slice(base.length).replace(/^v\d+\//, '');
    return rest.startsWith(`${folder}/`) && !rest.includes('..');
  }

  // Same signed upload the browser uses, sent from the server with the bytes as a file part.
  async uploadImage(bytes: Buffer, mediaType: string, folder: string): Promise<StoredImage> {
    const file = new Blob([new Uint8Array(bytes)], { type: mediaType });
    const json = await this.post('image', folder, file, `image.${extensionOf(mediaType)}`, UPLOAD_TIMEOUT_MS);
    return { url: json.url, width: json.width, height: json.height };
  }

  // A public URL is handed to Cloudinary to fetch, so the video never passes through us.
  async uploadVideo(source: VideoSource, folder: string): Promise<StoredVideo> {
    if ('bytes' in source) return this.postVideoBytes(source.bytes, folder);
    if (!source.headers) return this.post('video', folder, source.url, null, VIDEO_UPLOAD_TIMEOUT_MS);
    return this.postVideoBytes(await downloadVideo(source.url, source.headers), folder);
  }

  private postVideoBytes(bytes: Buffer, folder: string): Promise<StoredVideo> {
    const file = new Blob([new Uint8Array(bytes)], { type: 'video/mp4' });
    return this.post('video', folder, file, 'video.mp4', VIDEO_UPLOAD_TIMEOUT_MS);
  }

  private async post(
    kind: MediaKind,
    folder: string,
    file: Blob | string,
    filename: string | null,
    timeoutMs: number,
  ): Promise<StoredVideo> {
    const signed = { folder, timestamp: String(Math.floor(this.now() / 1000)) };
    const form = new FormData();
    for (const [name, value] of Object.entries(signed)) form.append(name, value);
    form.append('api_key', this.credentials.apiKey);
    form.append('signature', signParams(signed, this.credentials.apiSecret));
    if (typeof file === 'string') form.append('file', file);
    else form.append('file', file, filename ?? 'upload');

    let response: Response;
    try {
      response = await fetch(`https://api.cloudinary.com/v1_1/${this.credentials.cloudName}/${kind}/upload`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new Error('Could not reach media storage');
    }
    if (!response.ok) throw new Error(`Media storage rejected the upload with status ${response.status}`);
    const json = (await response.json()) as { secure_url?: unknown; width?: unknown; height?: unknown; duration?: unknown };
    if (typeof json.secure_url !== 'string') throw new Error('Media storage returned no URL');
    return {
      url: json.secure_url,
      width: typeof json.width === 'number' ? json.width : null,
      height: typeof json.height === 'number' ? json.height : null,
      durationSeconds: typeof json.duration === 'number' ? json.duration : null,
    };
  }
}

const UPLOAD_TIMEOUT_MS = 60_000;
// Cloudinary fetches and transcodes the source before answering.
const VIDEO_UPLOAD_TIMEOUT_MS = 180_000;
// A 15-second 720p clip is a few megabytes; anything far larger is not a reel clip.
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

async function downloadVideo(url: string, headers: Record<string, string>): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(VIDEO_UPLOAD_TIMEOUT_MS) });
  } catch {
    throw new Error('Could not download the video from its provider');
  }
  if (!response.ok) throw new Error(`The video provider answered ${response.status} to the download`);
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_VIDEO_BYTES) throw new Error('The video is larger than a reel clip can be');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_VIDEO_BYTES) throw new Error('The video is larger than a reel clip can be');
  return bytes;
}

function extensionOf(mediaType: string): string {
  if (mediaType === 'image/jpeg') return 'jpg';
  if (mediaType === 'image/webp') return 'webp';
  return 'png';
}
