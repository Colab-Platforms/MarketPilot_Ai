import { Injectable } from '@nestjs/common';
import { ErrorCode, type MediaPurpose, type MediaUploadTicket } from '@marketpilot/contracts';
import { DomainError } from '@/common';
import { MediaStoragePort } from '@/infra/storage';

const ROOT: Record<MediaPurpose, string> = {
  product_image: 'marketpilot_products',
  brand_logo: 'marketpilot_brand',
  reference_post: 'marketpilot_posts',
};

// One folder per workspace, so a ticket for one tenant can never vouch for another's files.
export const mediaFolder = (purpose: MediaPurpose, workspaceId: string) => `${ROOT[purpose]}/${workspaceId}`;

@Injectable()
export class BrandMediaService {
  constructor(private readonly media: MediaStoragePort) {}

  uploadTicket(workspaceId: string, purpose: MediaPurpose): MediaUploadTicket {
    if (!this.media.isAvailable()) {
      throw new DomainError(ErrorCode.Internal, 'Image upload is not set up yet', 503);
    }
    return this.media.createUploadTicket(mediaFolder(purpose, workspaceId));
  }

  isUpload(url: string, purpose: MediaPurpose, workspaceId: string): boolean {
    return this.media.ownsUrl(url, mediaFolder(purpose, workspaceId));
  }
}
