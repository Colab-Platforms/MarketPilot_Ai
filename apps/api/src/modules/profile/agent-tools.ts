import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { SECTIONS, type ProfileFieldState, type ProfileResponse } from '@marketpilot/contracts';
import { ALL_ROLES, type AgentToolSource, type AnyTool, type ReadToolDefinition } from '@/common';
import { PrismaService } from '@/infra/prisma';
import { BrandProfileService } from '@/modules/brand';

const SECTION_IDS = SECTIONS.map((s) => s.id) as [string, ...string[]];
const VALUE_CHARS = 300;

const getArgs = z
  .object({
    section: z
      .enum(SECTION_IDS)
      .optional()
      .describe(`One section to read. Omit for the whole profile. Sections: ${SECTION_IDS.join(', ')}.`),
  })
  .strict();

interface ProfileView {
  profile: ProfileResponse;
  section: string | undefined;
}

function valueText(field: ProfileFieldState): string | null {
  if (field.display) return field.display;
  const { value } = field;
  if (value === null || value === undefined) return null;
  if (field.kind === 'images' && Array.isArray(value)) {
    return value.length > 0 ? `${value.length} image${value.length === 1 ? '' : 's'} uploaded` : null;
  }
  const label = (raw: string) => field.options?.find((o) => o.value === raw)?.label ?? raw;
  if (Array.isArray(value)) return value.length > 0 ? value.map((v) => label(String(v))).join(', ') : null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, VALUE_CHARS);
  const text = label(String(value)).trim();
  return text ? text.slice(0, VALUE_CHARS) : null;
}

// Filled fields with their values and where they came from, then the names of what is missing,
// so the copilot can both answer from the profile and say what is left to fill.
function summarize({ profile, section }: ProfileView): string {
  const sections = profile.sections.filter((s) => !section || s.id === section);
  const lines = [
    `Business: ${profile.brand.name}${profile.brand.category ? ` (${profile.brand.category})` : ''}`,
    `Profile completeness: ${profile.completeness.filled} of ${profile.completeness.total} fields`,
  ];
  for (const s of sections) {
    const filled = s.fields.flatMap((f) => {
      const text = f.status === 'missing' ? null : valueText(f);
      return text ? [`- ${f.label}: ${text} [${f.status}]`] : [];
    });
    // A section the owner switched off is not relevant to them, so nothing in it is "missing".
    const missing = s.skipped ? [] : s.fields.filter((f) => f.status === 'missing' && f.editable && !f.hidden).map((f) => f.label);
    lines.push(`\n## ${s.title} (${s.skipped ? 'not relevant to this business' : `${s.filled}/${s.total}`})`, ...filled);
    if (missing.length > 0) lines.push(`Missing: ${missing.join(', ')}`);
  }
  return lines.join('\n');
}

@Injectable()
export class ProfileAgentTools implements AgentToolSource {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: BrandProfileService,
  ) {}

  tools(): AnyTool[] {
    const get: ReadToolDefinition<z.infer<typeof getArgs>, ProfileView> = {
      name: 'profile.get',
      domain: 'profile',
      kind: 'read',
      label: 'Reading your business profile',
      description:
        'Read the brand profile exactly as the owner sees it: every filled field with its source, and which ' +
        'fields are still missing. Use for "what does my profile say", "what is missing", or before suggesting ' +
        'a profile change. Not for searching website text (use brain.search).',
      args: getArgs,
      roles: ALL_ROLES,
      pages: ['/brand'],
      run: async (ctx, args) => ({
        profile: await this.prisma.withTenant(ctx.workspaceId, (tx) => this.profiles.read(tx, ctx.workspaceId)),
        section: args.section,
      }),
      summarize,
    };
    return [get];
  }
}
