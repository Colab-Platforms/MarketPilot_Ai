import { createHash } from 'node:crypto';
import type { MediaUploadTicket } from '@marketpilot/contracts';
import { MediaStoragePort } from './media-storage.port';

// Cloudinary honours a signature for one hour from its timestamp.
const TICKET_TTL_MS = 60 * 60 * 1000;
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp';

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

  createUploadTicket(folder: string): MediaUploadTicket {
    const issuedAt = this.now();
    // `folder` places the asset and prefixes its public id in both fixed and dynamic folder
    // mode, which is what lets ownsUrl check the delivery path.
    const signed = { allowed_formats: ALLOWED_FORMATS, folder, timestamp: String(Math.floor(issuedAt / 1000)) };
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.credentials.cloudName}/image/upload`,
      fields: { ...signed, api_key: this.credentials.apiKey, signature: signParams(signed, this.credentials.apiSecret) },
      urlField: 'secure_url',
      expiresAt: new Date(issuedAt + TICKET_TTL_MS).toISOString(),
    };
  }

  ownsUrl(url: string, folder: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') return false;
    const base = `/${this.credentials.cloudName}/image/upload/`;
    if (!parsed.pathname.startsWith(base)) return false;
    // Delivery paths are [transformations/][v<version>/]<public_id>.<ext>.
    const rest = parsed.pathname.slice(base.length).replace(/^v\d+\//, '');
    return rest.startsWith(`${folder}/`) && !rest.includes('..');
  }
}
