import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  onboardingStateSchema,
  scanResponseSchema,
  type OnboardingState,
  type OnboardingStep,
  type ScanResponse,
} from '@marketpilot/contracts';
import { apiRequest } from '@/lib/api-client';

export const onboardingKey = ['onboarding'] as const;

export function useOnboarding() {
  return useQuery({
    queryKey: onboardingKey,
    queryFn: async (): Promise<OnboardingState> => onboardingStateSchema.parse(await apiRequest('/onboarding')),
  });
}

export function useSaveStep(step: OnboardingStep) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: unknown): Promise<OnboardingState> =>
      onboardingStateSchema.parse(await apiRequest(`/onboarding/steps/${step}`, { method: 'PUT', body })),
    onSuccess: (state) => queryClient.setQueryData(onboardingKey, state),
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<OnboardingState> =>
      onboardingStateSchema.parse(await apiRequest('/onboarding/complete', { method: 'POST' })),
    onSuccess: (state) => queryClient.setQueryData(onboardingKey, state),
  });
}

export const scanKey = ['onboarding', 'scan'] as const;
const POLL_MS = 1500;

export function isScanActive(scan: ScanResponse['scan'] | undefined): boolean {
  return scan?.status === 'queued' || scan?.status === 'running';
}

// Polls only while a scan is running, so a finished scan costs nothing.
export function useScan(enabled: boolean) {
  return useQuery({
    queryKey: scanKey,
    enabled,
    queryFn: async (): Promise<ScanResponse> => scanResponseSchema.parse(await apiRequest('/onboarding/scan')),
    refetchInterval: (query) => (isScanActive(query.state.data?.scan) ? POLL_MS : false),
  });
}

export function useStartScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (force: boolean): Promise<ScanResponse> =>
      scanResponseSchema.parse(await apiRequest('/onboarding/scan', { method: 'POST', body: { force } })),
    onSuccess: (response) => queryClient.setQueryData(scanKey, response),
  });
}
