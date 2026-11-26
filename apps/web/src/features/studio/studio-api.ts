import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  imageGenerationListSchema,
  imageGenerationSchema,
  type CreateImageGenerationInput,
  type ImageGeneration,
  type ImageGenerationList,
} from '@marketpilot/contracts';
import { apiRequest } from '@/lib/api-client';

export const imageGenerationsKey = ['studio', 'images'] as const;
const POLL_MS = 3000;

export const isActive = (g: ImageGeneration) => g.status === 'queued' || g.status === 'running';

export function useImageGenerations() {
  return useQuery({
    queryKey: imageGenerationsKey,
    queryFn: async (): Promise<ImageGenerationList> => imageGenerationListSchema.parse(await apiRequest('/studio/images')),
    refetchInterval: (query) => (query.state.data?.generations.some(isActive) ? POLL_MS : false),
  });
}

// One job, for a copilot block. While it runs, the Create page list is kept in step so a job
// started from chat shows up there too.
export function useImageGeneration(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [...imageGenerationsKey, id],
    queryFn: async (): Promise<ImageGeneration> => {
      const generation = imageGenerationSchema.parse(await apiRequest(`/studio/images/${id}`));
      const listed = queryClient
        .getQueryData<ImageGenerationList>(imageGenerationsKey)
        ?.generations.find((g) => g.id === id);
      if (listed?.status !== generation.status) void queryClient.invalidateQueries({ queryKey: imageGenerationsKey, exact: true });
      return generation;
    },
    refetchInterval: (query) => (query.state.data && !isActive(query.state.data) ? false : POLL_MS),
  });
}

// The key is made per submit, so a network retry of the same submit never pays twice.
export function useCreateImageGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { body: CreateImageGenerationInput; idempotencyKey: string }) =>
      imageGenerationSchema.parse(
        await apiRequest('/studio/images', { method: 'POST', body: input.body, idempotencyKey: input.idempotencyKey }),
      ),
    onSuccess: (created) => {
      queryClient.setQueryData<ImageGenerationList>(imageGenerationsKey, (list) =>
        list
          ? { ...list, generations: [created, ...list.generations.filter((g) => g.id !== created.id)] }
          : list,
      );
      void queryClient.invalidateQueries({ queryKey: imageGenerationsKey });
    },
  });
}
