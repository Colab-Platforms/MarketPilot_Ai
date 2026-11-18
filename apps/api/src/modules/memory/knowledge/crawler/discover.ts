import type { PageType } from '@prisma/client';
import { RobotsRules } from './robots';

const GROUPS: { type: PageType; pattern: RegExp; score: number; cap: number }[] = [
  { type: 'about', pattern: /(^|\/)(about|about-us|our-story|who-we-are|story)(\/|$)/i, score: 10, cap: 2 },
  { type: 'contact', pattern: /(contact|reach-us|find-us|store-locator|locations?)/i, score: 9, cap: 2 },
  { type: 'product', pattern: /(^|\/)(products?|shop|collections?|store|catalog(ue)?|menu)(\/|$)/i, score: 6, cap: 3 },
  { type: 'service', pattern: /(^|\/)(services?|our-services|treatments|courses|packages|rooms|pricing)(\/|$)/i, score: 6, cap: 3 },
  { type: 'faq', pattern: /(^|\/)(faqs?|help)(\/|$)/i, score: 4, cap: 1 },
  { type: 'policy', pattern: /(policy|policies|shipping|returns?|refund|terms)/i, score: 3, cap: 1 },
];

export function classifyPath(pathname: string): PageType {
  if (pathname === '/' || pathname === '') return 'home';
  return GROUPS.find((group) => group.pattern.test(pathname))?.type ?? 'other';
}

export interface PlannedPage {
  url: string;
  // Guessed well-known paths are allowed to 404 without counting as a failure.
  guessed: boolean;
}

const depth = (url: string) => new URL(url).pathname.split('/').filter(Boolean).length;
const sameSite = (a: string, b: string) => a.replace(/^www\./, '') === b.replace(/^www\./, '');

// Picks the pages most likely to describe the business, from the homepage's own links.
export function planPages(
  homeUrl: string,
  links: string[],
  limit: number,
  robots: RobotsRules,
): PlannedPage[] {
  const home = new URL(homeUrl);
  const scored = new Map<string, { score: number; type: PageType }>();

  for (const link of links) {
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      continue;
    }
    if (!sameSite(url.hostname, home.hostname) || url.pathname === '/' || url.pathname === home.pathname) continue;
    if (url.pathname.split('/').filter(Boolean).length > 3) continue;
    const group = GROUPS.find((candidate) => candidate.pattern.test(url.pathname));
    if (!group || !robots.isAllowed(url.pathname)) continue;
    const key = `${home.origin}${url.pathname}`;
    if (!scored.has(key)) scored.set(key, { score: group.score, type: group.type });
  }

  // Shallow paths first, and a few pages per kind: ten near-identical "about" pages
  // add load and noise, not information.
  const taken = new Map<PageType, number>();
  const planned: PlannedPage[] = [...scored.entries()]
    .sort((a, b) => b[1].score - a[1].score || depth(a[0]) - depth(b[0]))
    .filter(([, entry]) => {
      const used = taken.get(entry.type) ?? 0;
      if (used >= (GROUPS.find((g) => g.type === entry.type)?.cap ?? 1)) return false;
      taken.set(entry.type, used + 1);
      return true;
    })
    .map(([url]) => ({ url, guessed: false }));

  const found = new Set([...scored.values()].map((entry) => entry.type));
  const guesses: [PageType, string[]][] = [
    ['about', ['/about-us', '/about']],
    ['contact', ['/contact-us', '/contact']],
  ];
  for (const [type, paths] of guesses) {
    if (found.has(type)) continue;
    for (const path of paths) {
      if (robots.isAllowed(path)) planned.push({ url: `${home.origin}${path}`, guessed: true });
    }
  }
  return planned.slice(0, limit);
}
