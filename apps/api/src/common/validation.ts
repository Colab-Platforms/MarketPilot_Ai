import { ErrorCode } from '@marketpilot/contracts';
import type { ZodType, ZodTypeDef } from 'zod';
import { DomainError } from './filters/domain-error';

export function parseWithSchema<T>(schema: ZodType<T, ZodTypeDef, unknown>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  throw new DomainError(ErrorCode.Validation, 'Check the highlighted fields', 400, { fields });
}
