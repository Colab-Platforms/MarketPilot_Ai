import { z } from 'zod';
import type { ProfileFieldDef } from '@marketpilot/contracts';

// Provider structured-output modes handle a limited slice of JSON Schema, and a
// schema with many nullable (union) properties can be rejected outright. So the
// answer format uses no unions: "nothing found" is an empty string or empty list,
// and `basis: "none"`.

export const SUPPORTED_KINDS = new Set(['text', 'textarea', 'select', 'multiselect', 'tags']);

export const BASES = ['stated', 'inferred', 'none'] as const;

// Property names are plain identifiers; a dot in a registry key (policy.return_policy) becomes "__".
export const toProp = (key: string) => key.replace(/\./g, '__');
export const fromProp = (prop: string) => prop.replace(/__/g, '.');

function valueSchema(def: ProfileFieldDef): Record<string, unknown> {
  switch (def.kind) {
    case 'select':
      return { type: 'string', enum: ['', ...(def.options ?? []).map((o) => o.value)] };
    case 'multiselect':
      return { type: 'array', items: { type: 'string', enum: (def.options ?? []).map((o) => o.value) } };
    case 'tags':
      return { type: 'array', items: { type: 'string' } };
    default:
      return { type: 'string' };
  }
}

function describe(def: ProfileFieldDef, mode: string): string {
  const parts = [def.label];
  if (def.helper) parts.push(def.helper);
  if (def.maxLength) parts.push(`At most ${def.maxLength} characters.`);
  if (def.kind === 'tags') parts.push('A list of short items.');
  parts.push(mode === 'stated' ? 'Only what the site states, with a quote.' : 'Inference allowed, labelled as such.');
  return parts.join(' ');
}

export function buildAnswerSchema(
  fields: readonly { def: ProfileFieldDef; mode: string }[],
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const { def, mode } of fields) {
    properties[toProp(def.key)] = {
      type: 'object',
      description: describe(def, mode),
      properties: {
        value: valueSchema(def),
        basis: { type: 'string', enum: [...BASES] },
        evidence: { type: 'string' },
      },
      required: ['value', 'basis', 'evidence'],
      additionalProperties: false,
    };
  }
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

// What the model sends back for one field. Validated here because a provider may
// ignore the schema it was given.
export const answerEntrySchema = z.object({
  value: z.union([z.string(), z.array(z.string())]),
  basis: z.enum(BASES),
  evidence: z.string(),
});
export type AnswerEntry = z.infer<typeof answerEntrySchema>;
