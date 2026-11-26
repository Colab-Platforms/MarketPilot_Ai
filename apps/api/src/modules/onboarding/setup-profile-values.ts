import { classifyLink, type BasicsStepInput } from '@marketpilot/contracts';

// Setup answers that belong to the brand profile, keyed as the profile registry names them,
// so they go through the same validated write path as the Brand profile page.
export function basicsProfileValues(input: BasicsStepInput): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  if (input.salesChannels && input.salesChannels.length > 0) values.salesChannels = input.salesChannels;
  for (const link of input.socialLinks ?? []) {
    const kind = classifyLink(link);
    // Google Maps has no profile field yet; the link stays in the onboarding answers.
    if (kind?.kind !== 'social') continue;
    const key = `social.${kind.provider}`;
    if (!(key in values)) values[key] = kind.url;
  }
  return values;
}

// The first language is the main one; the rest become secondary languages.
export function postLanguageValues(languages: readonly string[]): Record<string, unknown> {
  const [main, ...rest] = languages;
  return { 'brand.language': main, 'brand.secondaryLanguages': rest };
}
