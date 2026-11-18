import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  competitorListSchema,
  type CompetitorList,
  type CreateCompetitorInput,
  type UpdateCompetitorInput,
} from '@marketpilot/contracts';
import { apiRequest } from '@/lib/api-client';

export const competitorsKey = ['brand', 'competitors'] as const;
const POLL_MS = 2000;

const parse = async (request: Promise<unknown>): Promise<CompetitorList> => competitorListSchema.parse(await request);

export function useCompetitors() {
  return useQuery({
    queryKey: competitorsKey,
    queryFn: () => parse(apiRequest('/brand/competitors')),
    refetchInterval: (query) => (query.state.data?.discovery.status === 'running' ? POLL_MS : false),
  });
}

// Every change returns the fresh list, so the cache is replaced rather than refetched.
function useListMutation<TInput>(send: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => parse(send(input)),
    onSuccess: (list) => queryClient.setQueryData(competitorsKey, list),
  });
}

export const useDiscoverCompetitors = () =>
  useListMutation<void>(() => apiRequest('/brand/competitors/discover', { method: 'POST', body: {} }));

export const useAddCompetitor = () =>
  useListMutation<CreateCompetitorInput>((body) => apiRequest('/brand/competitors', { method: 'POST', body }));

export const useUpdateCompetitor = () =>
  useListMutation<{ id: string; changes: UpdateCompetitorInput }>(({ id, changes }) =>
    apiRequest(`/brand/competitors/${id}`, { method: 'PATCH', body: changes }),
  );

export const useRemoveCompetitor = () =>
  useListMutation<string>((id) => apiRequest(`/brand/competitors/${id}`, { method: 'DELETE' }));
