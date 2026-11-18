import { competitorAnswerSchema } from './competitor-schema';

export interface AiCompetitor {
  name: string;
  websiteUrl: string;
  domain: string;
  summary: string | null;
  whySimilar: string | null;
  offerings: string[];
  priceRange: string | null;
  positioning: string | null;
  // The search results that back this competitor.
  evidence: string[];
  // `knowledge`: named by the model, not seen in search; its homepage must then carry its name.
  grounding: 'search' | 'knowledge';
}

export const MAX_SUGGESTED = 8;

// Sellers' platforms, directories, review, social and news sites: never a competitor, even
// when a search result lists them.
const NOT_COMPETITORS = [
  'amazon.', 'flipkart.com', 'myntra.com', 'nykaa.com', 'meesho.com', 'snapdeal.com', 'jiomart.com',
  'bigbasket.com', 'blinkit.com', 'zeptonow.com', 'tatacliq.com', 'ajio.com', '1mg.com', 'netmeds.com',
  'pharmeasy.in', 'apollopharmacy.in', 'practo.com', 'justdial.com', 'indiamart.com', 'tradeindia.com',
  'sulekha.com', 'zomato.com', 'swiggy.com', 'magicpin.in', 'urbancompany.com', 'google.', 'facebook.com',
  'instagram.com', 'youtube.com', 'linkedin.com', 'twitter.com', 'x.com', 'pinterest.', 'wikipedia.org',
  'quora.com', 'reddit.com', 'medium.com', 'crunchbase.com', 'tracxn.com', 'zaubacorp.com', 'tofler.in',
  'glassdoor.', 'ambitionbox.com', 'economictimes.indiatimes.com', 'timesofindia.indiatimes.com',
  'livemint.com', 'moneycontrol.com', 'business-standard.com', 'ndtv.com', 'yourstory.com', 'inc42.com',
  'thehindu.com', 'hindustantimes.com', 'forbesindia.com', 'trustpilot.com', 'mouthshut.com',
];

export function domainOf(raw: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return host.includes('.') ? host : null;
  } catch {
    return null;
  }
}

const isExcluded = (domain: string) =>
  NOT_COMPETITORS.some((entry) => (entry.endsWith('.') ? domain.startsWith(entry) || domain.includes(`.${entry}`) : domain === entry || domain.endsWith(`.${entry}`)));

// shop.brand.in and brand.in are the same company.
const sameSite = (a: string, b: string) => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);

const clip = (value: string | null, max: number) => {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
};

// Turns the model's answer into competitors we can stand behind. A competitor survives only
// if web search returned its website, or the recall step named it (and the caller then
// checks its homepage), so a brand invented while ranking cannot.
export function verifyCompetitors(
  data: unknown,
  sources: string[],
  exclude: { ownDomain: string | null; knownDomains: string[] },
  recalledDomains: string[] = [],
): AiCompetitor[] {
  const parsed = competitorAnswerSchema.safeParse(data);
  if (!parsed.success) return [];
  const taken = new Set(exclude.knownDomains);
  if (exclude.ownDomain) taken.add(exclude.ownDomain);

  const out: AiCompetitor[] = [];
  for (const item of parsed.data.competitors) {
    const name = clip(item.name, 120);
    const domain = domainOf(item.website);
    if (!name || !domain || isExcluded(domain)) continue;
    if ([...taken].some((d) => sameSite(d, domain))) continue;
    const evidence = sources.filter((url) => {
      const d = domainOf(url);
      return d !== null && sameSite(d, domain);
    });
    const recalled = recalledDomains.some((d) => sameSite(d, domain));
    if (evidence.length === 0 && !recalled) continue;
    taken.add(domain);
    out.push({
      name,
      websiteUrl: `https://${domain}/`,
      domain,
      summary: clip(item.summary, 300),
      whySimilar: clip(item.whySimilar, 300),
      offerings: [...new Set(item.offerings.map((o) => clip(o, 80)).filter((o): o is string => Boolean(o)))].slice(0, 8),
      priceRange: clip(item.priceRange, 120),
      positioning: clip(item.positioning, 300),
      evidence: evidence.slice(0, 5),
      grounding: evidence.length > 0 ? 'search' : 'knowledge',
    });
    if (out.length >= MAX_SUGGESTED) break;
  }
  return out;
}
