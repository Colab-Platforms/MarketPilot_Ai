import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  productListSchema,
  profileResponseSchema,
  scanResponseSchema,
  serviceListSchema,
  type ProductChange,
  type ProductList,
  type ProfileResponse,
  type ReviewDecision,
  type ScanResponse,
  type ServiceChange,
  type ServiceList,
} from '@marketpilot/contracts';
import { apiRequest } from '@/lib/api-client';

export const profileKey = ['brand', 'profile'] as const;
export const productsKey = ['brand', 'products'] as const;
export const servicesKey = ['brand', 'services'] as const;
export const profileScanKey = ['brand', 'scan'] as const;
const POLL_MS = 1500;

export function useProfile() {
  return useQuery({
    queryKey: profileKey,
    queryFn: async (): Promise<ProfileResponse> => profileResponseSchema.parse(await apiRequest('/brand/profile')),
  });
}

export interface ProfileChanges {
  values?: Record<string, unknown>;
  products?: ProductChange[];
  services?: ServiceChange[];
}

// The one save for everything about the business. Only what changed is sent; a null value
// clears a field, and catalogue entries are created, edited or removed in the same call.
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (changes: ProfileChanges): Promise<ProfileResponse> =>
      profileResponseSchema.parse(await apiRequest('/brand/profile', { method: 'PUT', body: changes })),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey, profile);
      void queryClient.invalidateQueries({ queryKey: productsKey });
      void queryClient.invalidateQueries({ queryKey: servicesKey });
    },
  });
}

// Switches a section off as not relevant (it stops counting toward completeness), or back on.
export function useSetSectionSkipped() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, skipped }: { id: string; skipped: boolean }): Promise<ProfileResponse> =>
      profileResponseSchema.parse(
        await apiRequest(`/brand/profile/sections/${encodeURIComponent(id)}`, { method: 'PUT', body: { skipped } }),
      ),
    onSuccess: (profile) => queryClient.setQueryData(profileKey, profile),
  });
}

export function useProducts(enabled: boolean) {
  return useQuery({
    queryKey: productsKey,
    enabled,
    queryFn: async (): Promise<ProductList> => productListSchema.parse(await apiRequest('/brand/products')),
  });
}

export function useServices(enabled: boolean) {
  return useQuery({
    queryKey: servicesKey,
    enabled,
    queryFn: async (): Promise<ServiceList> => serviceListSchema.parse(await apiRequest('/brand/services')),
  });
}

export function isScanActive(scan: ScanResponse['scan'] | undefined): boolean {
  return scan?.status === 'queued' || scan?.status === 'running';
}

export function useProfileScan() {
  return useQuery({
    queryKey: profileScanKey,
    queryFn: async (): Promise<ScanResponse> => scanResponseSchema.parse(await apiRequest('/brand/profile/scan')),
    refetchInterval: (query) => (isScanActive(query.state.data?.scan) ? POLL_MS : false),
  });
}

export function useStartProfileScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (force: boolean): Promise<ScanResponse> =>
      scanResponseSchema.parse(await apiRequest('/brand/profile/scan', { method: 'POST', body: { force } })),
    onSuccess: (response) => queryClient.setQueryData(profileScanKey, response),
  });
}

export function useApplyScanReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (decisions: ReviewDecision[]): Promise<ProfileResponse> =>
      profileResponseSchema.parse(
        await apiRequest('/brand/profile/scan/review', { method: 'POST', body: { decisions } }),
      ),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey, profile);
      void queryClient.invalidateQueries({ queryKey: profileScanKey });
      void queryClient.invalidateQueries({ queryKey: productsKey });
    },
  });
}
