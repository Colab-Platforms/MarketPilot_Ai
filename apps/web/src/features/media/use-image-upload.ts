import { useMutation } from '@tanstack/react-query';
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  mediaUploadTicketSchema,
  type MediaPurpose,
} from '@marketpilot/contracts';
import { apiRequest } from '@/lib/api-client';

export const IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(',');
export const MAX_IMAGE_MB = MAX_IMAGE_BYTES / (1024 * 1024);

export function imageFileProblem(file: File): string | null {
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) return `${file.name} is not a JPG, PNG or WebP image`;
  if (file.size > MAX_IMAGE_BYTES) return `${file.name} is over ${MAX_IMAGE_MB} MB`;
  return null;
}

// Gets a ticket from our API, then sends the file straight to storage. Returns its public URL;
// the caller saves that URL with the rest of its form.
export function useImageUpload(purpose: MediaPurpose) {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const ticket = mediaUploadTicketSchema.parse(
        await apiRequest('/brand/media/upload-ticket', { method: 'POST', body: { purpose } }),
      );
      const form = new FormData();
      for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
      form.append('file', file);
      const response = await fetch(ticket.uploadUrl, { method: 'POST', body: form });
      if (!response.ok) throw new Error(`Upload failed with status ${response.status}`);
      const url = ((await response.json()) as Record<string, unknown>)[ticket.urlField];
      if (typeof url !== 'string') throw new Error('Upload response had no URL');
      return url;
    },
  });
}
