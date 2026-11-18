import { z } from 'zod';

export const ErrorCode = {
  Validation: 'validation_error',
  Unauthenticated: 'unauthenticated',
  Forbidden: 'forbidden',
  EmailNotVerified: 'email_not_verified',
  NotFound: 'not_found',
  Conflict: 'conflict',
  RateLimited: 'rate_limited',
  InsufficientCredits: 'insufficient_credits',
  Internal: 'internal_error',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.nativeEnum(ErrorCode),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    requestId: z.string().optional(),
  }),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
