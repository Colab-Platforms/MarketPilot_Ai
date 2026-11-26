import { useCallback, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { MAX_FILES_PER_UPLOAD, fileProblem, useUploadAsset } from './library-api';

export interface PendingUpload {
  key: string;
  name: string;
  error: string | null;
}

// Each chosen file uploads on its own; finished ones leave the list (they are now in the
// library), failed ones stay with their reason until dismissed.
export function useLibraryUploads() {
  const upload = useUploadAsset();
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const start = useCallback(
    (files: File[]) => {
      setNotice(files.length > MAX_FILES_PER_UPLOAD ? `Only the first ${MAX_FILES_PER_UPLOAD} files were added. Upload the rest next.` : null);
      for (const file of files.slice(0, MAX_FILES_PER_UPLOAD)) {
        const key = crypto.randomUUID();
        const problem = fileProblem(file);
        setPending((list) => [...list, { key, name: file.name, error: problem }]);
        if (problem) continue;
        upload
          .mutateAsync(file)
          .then(() => setPending((list) => list.filter((p) => p.key !== key)))
          .catch((error: unknown) => {
            const message = error instanceof ApiError ? error.message : `We could not upload ${file.name}. Try again.`;
            setPending((list) => list.map((p) => (p.key === key ? { ...p, error: message } : p)));
          });
      }
    },
    [upload],
  );

  const dismiss = useCallback((key: string) => setPending((list) => list.filter((p) => p.key !== key)), []);

  return { pending, notice, start, dismiss, clearNotice: () => setNotice(null) };
}
