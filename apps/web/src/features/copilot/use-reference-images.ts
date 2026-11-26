import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MAX_FIELD_IMAGES, profileResponseSchema, type ProfileResponse } from '@marketpilot/contracts';
import { apiRequest } from '@/lib/api-client';
import { profileKey, useProfile } from '@/features/profile/profile-api';

// The brand profile's "Your recent posts" field: new images use these as their visual reference.
const REFERENCE_FIELD_KEY = 'recentPostImages';

function savedReferences(profile: ProfileResponse | undefined): string[] {
  const field = profile?.sections.flatMap((s) => s.fields).find((f) => f.key === REFERENCE_FIELD_KEY);
  return Array.isArray(field?.value) ? field.value.filter((v): v is string => typeof v === 'string') : [];
}

export function useReferenceSlots(): number {
  const profile = useProfile();
  return MAX_FIELD_IMAGES - savedReferences(profile.data).length;
}

export class ReferenceLimitError extends Error {
  constructor(saved: number) {
    super(
      `Your brand profile already has ${saved} of ${MAX_FIELD_IMAGES} reference images. Remove some on the Brand page, then try again.`,
    );
  }
}

// Adds uploaded images to the profile's reference images. Reads the latest profile first so
// images added elsewhere since the panel opened are kept.
export function useSaveReferenceImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (urls: string[]): Promise<ProfileResponse> => {
      const current = profileResponseSchema.parse(await apiRequest('/brand/profile'));
      const saved = savedReferences(current);
      const merged = [...new Set([...saved, ...urls])];
      if (merged.length > MAX_FIELD_IMAGES) throw new ReferenceLimitError(saved.length);
      return profileResponseSchema.parse(
        await apiRequest('/brand/profile', {
          method: 'PUT',
          body: { values: { [REFERENCE_FIELD_KEY]: merged } },
        }),
      );
    },
    onSuccess: (profile) => queryClient.setQueryData(profileKey, profile),
  });
}
