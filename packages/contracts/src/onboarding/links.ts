import type { SocialProviderName } from './scan';

export const SOCIAL_HOSTS: readonly { provider: SocialProviderName; hosts: readonly string[] }[] = [
  { provider: 'instagram', hosts: ['instagram.com'] },
  { provider: 'facebook', hosts: ['facebook.com', 'fb.com'] },
  { provider: 'youtube', hosts: ['youtube.com'] },
  { provider: 'linkedin', hosts: ['linkedin.com'] },
  { provider: 'x', hosts: ['x.com', 'twitter.com'] },
  { provider: 'tiktok', hosts: ['tiktok.com'] },
  { provider: 'pinterest', hosts: ['pinterest.com'] },
  { provider: 'whatsapp', hosts: ['wa.me', 'api.whatsapp.com'] },
];

const MAPS_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'maps.google.com', 'g.page'];

export type LinkKind =
  | { kind: 'website'; url: string }
  | { kind: 'social'; provider: SocialProviderName; url: string }
  | { kind: 'maps'; url: string };

export function normalizeHost(hostname: string): string {
  return hostname.replace(/^www\./, '').replace(/^m\./, '').toLowerCase();
}

// What a link the owner pasted points at. Only websites can be read today; social pages
// are saved to the profile and Google Maps links are kept for later (docs/ONBOARDING.md).
export function classifyLink(raw: string): LinkKind | null {
  const value = raw.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = normalizeHost(url.hostname);
  if (!host.includes('.')) return null;
  const href = url.toString();
  const social = SOCIAL_HOSTS.find((entry) => entry.hosts.includes(host));
  if (social) return { kind: 'social', provider: social.provider, url: href };
  if (MAPS_HOSTS.includes(host) || (host.startsWith('google.') && url.pathname.startsWith('/maps'))) {
    return { kind: 'maps', url: href };
  }
  return { kind: 'website', url: href };
}
