import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assetSchema, type Asset, type UpdateAssetFeedbackInput } from '@marketpilot/contracts';
import { apiRequest } from '@/lib/api-client';
import { imageGenerationsKey } from '@/features/studio/studio-api';
import { assetsKey } from './library-api';

// The same image shows in the library, on the Create page and in the copilot, so every view refreshes.
function useRefreshViews() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: assetsKey });
    void queryClient.invalidateQueries({ queryKey: imageGenerationsKey });
  };
}

export function useSetFeedback() {
  const refresh = useRefreshViews();
  return useMutation({
    mutationFn: async ({ assetId, body }: { assetId: string; body: UpdateAssetFeedbackInput }): Promise<Asset> =>
      assetSchema.parse(await apiRequest(`/assets/${assetId}/feedback`, { method: 'PUT', body })),
    onSuccess: refresh,
  });
}

export function useSetStyleReference() {
  const refresh = useRefreshViews();
  return useMutation({
    mutationFn: async ({ assetId, styleReference }: { assetId: string; styleReference: boolean }): Promise<Asset> =>
      assetSchema.parse(await apiRequest(`/assets/${assetId}/style-reference`, { method: 'PUT', body: { styleReference } })),
    onSuccess: refresh,
  });
}
