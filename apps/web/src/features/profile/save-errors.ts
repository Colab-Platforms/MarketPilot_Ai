import { ApiError } from '@/lib/api-client';

// The API keys catalogue errors by position ("products.0.name"). A form that saves one entry
// strips that prefix so each message lands on its own field.
export function saveErrors(error: unknown, prefix: string): Record<string, string> {
  if (!(error instanceof ApiError)) return { form: 'Something went wrong. Try again.' };
  const own = Object.entries(error.fields)
    .filter(([key]) => key.startsWith(`${prefix}.`))
    .map(([key, message]) => [key.slice(prefix.length + 1), message] as const);
  return own.length > 0 ? Object.fromEntries(own) : { form: error.message };
}
