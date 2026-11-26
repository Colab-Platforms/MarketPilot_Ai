import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  VIDEO_MIME_TYPES,
  assetListSchema,
  assetSchema,
  mediaUploadTicketSchema,
  type Asset,
  type AssetKind,
  type AssetList,
  type AssetSource,
} from '@marketpilot/contracts';
import { apiRequest } from '@/lib/api-client';

export const assetsKey = ['assets'] as const;
export const LIBRARY_ACCEPT = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].join(',');
export const MAX_FILES_PER_UPLOAD = 10;

export interface AssetFilter {
  kind: AssetKind | null;
  source: AssetSource | null;
}

export function useAssets(filter: AssetFilter) {
  return useInfiniteQuery({
    queryKey: [...assetsKey, filter],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<AssetList> => {
      const params = new URLSearchParams();
      if (filter.kind) params.set('kind', filter.kind);
      if (filter.source) params.set('source', filter.source);
      if (pageParam) params.set('cursor', pageParam);
      const query = params.toString();
      return assetListSchema.parse(await apiRequest(`/assets${query ? `?${query}` : ''}`));
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function kindOf(file: File): AssetKind | null {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) return 'image';
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(file.type)) return 'video';
  return null;
}

export function fileProblem(file: File): string | null {
  const kind = kindOf(file);
  if (!kind) return `${file.name} is not a JPG, PNG, WebP, MP4, MOV or WebM file`;
  const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > limit) return `${file.name} is over ${limit / (1024 * 1024)} MB`;
  return null;
}

interface MediaInfo {
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

// Read in the browser so the size and length shown never depend on the storage provider.
function readMediaInfo(file: File, kind: AssetKind): Promise<MediaInfo> {
  const src = URL.createObjectURL(file);
  const unknown: MediaInfo = { width: null, height: null, durationSeconds: null };
  return new Promise<MediaInfo>((resolve) => {
    if (kind === 'image') {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth || null, height: image.naturalHeight || null, durationSeconds: null });
      image.onerror = () => resolve(unknown);
      image.src = src;
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () =>
      resolve({
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
      });
    video.onerror = () => resolve(unknown);
    video.src = src;
  }).finally(() => URL.revokeObjectURL(src));
}

// Ticket from our API, the file straight to storage, then the stored URL saved to the library.
export function useUploadAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<Asset> => {
      const kind = kindOf(file);
      if (!kind) throw new Error(fileProblem(file) ?? 'Unsupported file');
      const [ticket, info] = await Promise.all([
        apiRequest('/assets/upload-ticket', { method: 'POST', body: { kind } }).then((t) => mediaUploadTicketSchema.parse(t)),
        readMediaInfo(file, kind),
      ]);
      const form = new FormData();
      for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
      form.append('file', file);
      const response = await fetch(ticket.uploadUrl, { method: 'POST', body: form });
      if (!response.ok) throw new Error(`Upload failed with status ${response.status}`);
      const url = ((await response.json()) as Record<string, unknown>)[ticket.urlField];
      if (typeof url !== 'string') throw new Error('Upload response had no URL');
      return assetSchema.parse(
        await apiRequest('/assets', {
          method: 'POST',
          body: { kind, url, name: file.name, bytes: file.size, ...info },
        }),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: assetsKey }),
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/assets/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      queryClient.setQueriesData<{ pages: AssetList[]; pageParams: unknown[] }>({ queryKey: assetsKey }, (data) =>
        data ? { ...data, pages: data.pages.map((page) => ({ ...page, assets: page.assets.filter((a) => a.id !== id) })) } : data,
      );
    },
  });
}
