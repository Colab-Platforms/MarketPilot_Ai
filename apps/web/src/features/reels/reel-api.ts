import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  reelListSchema,
  reelProjectSchema,
  type AddReelScene,
  type CreateReelInput,
  type ReelList,
  type ReelProject,
  type ReelStatus,
  type ReelVisualKind,
  type ReorderReelScenes,
  type UpdateReelCharacter,
  type UpdateReelScene,
} from '@marketpilot/contracts';
import { apiRequest } from '@/lib/api-client';

export const reelsKey = ['studio', 'reels'] as const;
const reelKey = (id: string) => [...reelsKey, id] as const;
const POLL_MS = 3000;

export const isWorking = (status: ReelStatus) =>
  status === 'ideating' || status === 'storyboarding';

// Polling continues while a step runs or any picture is being drawn.
const isBusy = (reel: ReelProject) =>
  isWorking(reel.status) ||
  reel.render?.status === 'queued' ||
  reel.render?.status === 'running' ||
  [...reel.visuals.portraits, ...reel.visuals.keyframes, ...reel.visuals.clips].some(
    (v) => v.drawing,
  );

export function useReels() {
  return useQuery({
    queryKey: reelsKey,
    queryFn: async (): Promise<ReelList> => reelListSchema.parse(await apiRequest('/studio/reels')),
    refetchInterval: (query) =>
      query.state.data?.reels.some((r) => isWorking(r.status)) ? POLL_MS : false,
  });
}

export function useReel(id: string) {
  return useQuery({
    queryKey: reelKey(id),
    queryFn: async (): Promise<ReelProject> =>
      reelProjectSchema.parse(await apiRequest(`/studio/reels/${id}`)),
    refetchInterval: (query) => (query.state.data && isBusy(query.state.data) ? POLL_MS : false),
  });
}

export function useCreateReel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { body: CreateReelInput; idempotencyKey: string }) =>
      reelProjectSchema.parse(
        await apiRequest('/studio/reels', {
          method: 'POST',
          body: input.body,
          idempotencyKey: input.idempotencyKey,
        }),
      ),
    onSuccess: (created) => {
      queryClient.setQueryData(reelKey(created.id), created);
      void queryClient.invalidateQueries({ queryKey: reelsKey, exact: true });
    },
  });
}

// Every change answers with the whole reel, which replaces the cached one.
function useReelMutation<TInput>(id: string, send: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TInput) => reelProjectSchema.parse(await send(input)),
    onSuccess: (reel) => {
      queryClient.setQueryData(reelKey(id), reel);
      void queryClient.invalidateQueries({ queryKey: reelsKey, exact: true });
    },
  });
}

// Steps that call a model take a key made per click, so a network retry never pays twice.
export function useMoreIdeas(id: string) {
  return useReelMutation(id, (idempotencyKey: string) =>
    apiRequest(`/studio/reels/${id}/ideas`, { method: 'POST', idempotencyKey }),
  );
}

export function useChooseIdea(id: string) {
  return useReelMutation(id, (input: { ideaId: string; idempotencyKey: string }) =>
    apiRequest(`/studio/reels/${id}/ideas/${input.ideaId}/choose`, {
      method: 'POST',
      idempotencyKey: input.idempotencyKey,
    }),
  );
}

export function useUpdateScene(id: string) {
  return useReelMutation(id, (input: { sceneId: string; changes: UpdateReelScene }) =>
    apiRequest(`/studio/reels/${id}/scenes/${input.sceneId}`, {
      method: 'PATCH',
      body: input.changes,
    }),
  );
}

export function useAddScene(id: string) {
  return useReelMutation(id, (body: AddReelScene) =>
    apiRequest(`/studio/reels/${id}/scenes`, { method: 'POST', body }),
  );
}

export function useDeleteScene(id: string) {
  return useReelMutation(id, (sceneId: string) =>
    apiRequest(`/studio/reels/${id}/scenes/${sceneId}`, { method: 'DELETE' }),
  );
}

export function useReorderScenes(id: string) {
  return useReelMutation(id, (body: ReorderReelScenes) =>
    apiRequest(`/studio/reels/${id}/scenes/order`, { method: 'PUT', body }),
  );
}

export function useRewriteScene(id: string) {
  return useReelMutation(
    id,
    (input: { sceneId: string; instruction: string; idempotencyKey: string }) =>
      apiRequest(`/studio/reels/${id}/scenes/${input.sceneId}/rewrite`, {
        method: 'POST',
        body: { instruction: input.instruction },
        idempotencyKey: input.idempotencyKey,
      }),
  );
}

export function useDrawVisuals(id: string) {
  return useReelMutation(id, (input: { kind: ReelVisualKind; idempotencyKey: string }) =>
    apiRequest(`/studio/reels/${id}/visuals`, {
      method: 'POST',
      body: { kind: input.kind },
      idempotencyKey: input.idempotencyKey,
    }),
  );
}

export function useAssembleReel(id: string) {
  return useReelMutation(id, (idempotencyKey: string) =>
    apiRequest(`/studio/reels/${id}/assemble`, { method: 'POST', idempotencyKey }),
  );
}

export function useRerenderClip(id: string) {
  return useReelMutation(id, (input: { sceneId: string; idempotencyKey: string }) =>
    apiRequest(`/studio/reels/${id}/scenes/${input.sceneId}/clip`, {
      method: 'POST',
      idempotencyKey: input.idempotencyKey,
    }),
  );
}

export function useRedrawPortrait(id: string) {
  return useReelMutation(id, (input: { characterId: string; idempotencyKey: string }) =>
    apiRequest(`/studio/reels/${id}/cast/${input.characterId}/portrait`, {
      method: 'POST',
      idempotencyKey: input.idempotencyKey,
    }),
  );
}

export function useRedrawKeyframe(id: string) {
  return useReelMutation(id, (input: { sceneId: string; idempotencyKey: string }) =>
    apiRequest(`/studio/reels/${id}/scenes/${input.sceneId}/keyframe`, {
      method: 'POST',
      idempotencyKey: input.idempotencyKey,
    }),
  );
}

export function useSelectTake(id: string) {
  return useReelMutation(id, (takeId: string) =>
    apiRequest(`/studio/reels/${id}/takes/${takeId}/select`, { method: 'PUT' }),
  );
}

export function useUpdateCharacter(id: string) {
  return useReelMutation(id, (input: { characterId: string; changes: UpdateReelCharacter }) =>
    apiRequest(`/studio/reels/${id}/cast/${input.characterId}`, {
      method: 'PATCH',
      body: input.changes,
    }),
  );
}
