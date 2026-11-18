import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import type { SocialProviderName } from '@marketpilot/contracts';

export interface ParsedPage {
  url: string;
  canonicalUrl: string;
  title: string | null;
  description: string | null;
  language: string | null;
  openGraph: Record<string, string>;
  jsonLd: Record<string, unknown>[];
  links: string[];
  // Content images with their alt text; on many sites the alt is the product's name.
  images: { src: string; alt: string }[];
  // An image marked as the logo, preferring one in the site header.
  logoUrl: string | null;
  // The site icon (apple-touch-icon first, as it is the largest), the last-resort logo.
  iconUrl: string | null;
  emails: string[];
  phones: string[];
  socials: { provider: SocialProviderName; url: string }[];
  // Main content only (menus, site header and footer removed), capped; stored as the document
  // and chunked for search, so every page's navigation does not crowd out its real content.
  text: string;
  // The footer, kept apart: it often holds the address and hours, but is noise as a chunk.
  footerText: string;
  textHash: string;
  currency: string | null;
  platformHints: string[];
}

const MAX_TEXT_CHARS = 20_000;
const MAX_IMAGES = 60;
const MAX_JSON_LD_BYTES = 300_000;
const SKIP_EXTENSIONS = /\.(jpe?g|png|gif|webp|svg|ico|pdf|zip|rar|mp4|mp3|avi|mov|css|js|xml|json|docx?|xlsx?)$/i;

const SOCIAL_HOSTS: { provider: SocialProviderName; hosts: string[] }[] = [
  { provider: 'instagram', hosts: ['instagram.com'] },
  { provider: 'facebook', hosts: ['facebook.com', 'fb.com'] },
  { provider: 'youtube', hosts: ['youtube.com'] },
  { provider: 'linkedin', hosts: ['linkedin.com'] },
  { provider: 'x', hosts: ['x.com', 'twitter.com'] },
  { provider: 'tiktok', hosts: ['tiktok.com'] },
  { provider: 'pinterest', hosts: ['pinterest.com'] },
  { provider: 'whatsapp', hosts: ['wa.me', 'api.whatsapp.com'] },
];
// Website builders and the networks themselves put their own profiles in footers
// ("Powered by Wix", "Follow us on Facebook"). Those are never the business's profile.
const VENDOR_HANDLES = new Set([
  'wix', 'wixcom', 'shopify', 'wordpress', 'wordpresscom', 'squarespace', 'woocommerce', 'godaddy',
  'webflow', 'elementor', 'weebly', 'zoho', 'facebook', 'instagram', 'twitter', 'x', 'youtube',
  'linkedin', 'whatsapp', 'pinterest', 'tiktok',
]);
const isVendorProfile = (path: string) =>
  path
    .split('/')
    .filter(Boolean)
    .some((segment) => VENDOR_HANDLES.has(segment.toLowerCase().replace(/[-_.@]/g, '')));

// Share buttons and plumbing, not the business's own profile.
const SOCIAL_NOISE = /(sharer|share\.php|\/share|intent\/|\/dialog\/|\/plugins\/|\/tr\?|login|\/hashtag\/|\/explore\/|\/p\/|\/reel\/)/i;

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const BOUNDARY_ELEMENTS =
  'p, div, section, article, main, ul, ol, li, h1, h2, h3, h4, h5, h6, tr, td, th, br, blockquote, form, label, button, a, option, address';
const CHROME_ELEMENTS = 'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"]';
const FOOTER_ELEMENTS = 'footer, [role="contentinfo"]';
const MAX_FOOTER_CHARS = 1_500;
// Below this, a page's "main" text is probably the whole page wrapped in a header or nav tag.
const MIN_MAIN_CHARS = 200;

// Element text is joined without separators by .text(), which glues "Home" "About" "Contact"
// into "HomeAboutContact". Marking the element edges keeps words apart.
function extractText($: cheerio.CheerioAPI): { text: string; footerText: string } {
  $(BOUNDARY_ELEMENTS).each((_, element) => {
    $(element).before(' ').after(' ');
  });
  const fullText = normalizeWhitespace($('body').text());
  const footerText = normalizeWhitespace($(FOOTER_ELEMENTS).first().text()).slice(0, MAX_FOOTER_CHARS);

  $(CHROME_ELEMENTS).remove();
  const mainText = normalizeWhitespace($('body').text());
  const text = mainText.length >= MIN_MAIN_CHARS ? mainText : fullText;
  return { text: text.slice(0, MAX_TEXT_CHARS), footerText: text === fullText ? '' : footerText };
}

export function canonicalize(raw: string, base?: string): string | null {
  try {
    const url = new URL(raw, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    url.search = '';
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}

export function socialFrom(href: string): { provider: SocialProviderName; url: string } | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '').toLowerCase();
  const match = SOCIAL_HOSTS.find((entry) => entry.hosts.includes(host));
  if (!match) return null;
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '' || SOCIAL_NOISE.test(url.pathname + url.search) || isVendorProfile(path)) return null;
  return { provider: match.provider, url: `https://${host === 'fb.com' ? 'facebook.com' : host}${path}` };
}

function httpUrl(raw: string | undefined, base: string): string | null {
  const value = (raw ?? '').trim();
  if (!value || value.startsWith('data:')) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const LOGO_HINT = /logo/i;
const HEADER = 'header, nav, [role="banner"]';

// Sites mark the logo in the image's own class, id, alt or file name, or on its link
// wrapper (<a class="logo"><img></a>). One in the header beats one elsewhere on the page.
function findLogo($: cheerio.CheerioAPI, pageUrl: string): string | null {
  let anywhere: string | null = null;
  for (const element of $('img').toArray()) {
    const img = $(element);
    const src = httpUrl(img.attr('src') ?? img.attr('data-src'), pageUrl);
    if (!src) continue;
    const marked = [img, img.parent(), img.parent().parent()].some((node) =>
      LOGO_HINT.test(`${node.attr('class') ?? ''} ${node.attr('id') ?? ''}`),
    );
    if (!marked && !LOGO_HINT.test(`${img.attr('alt') ?? ''} ${src}`)) continue;
    if (img.closest(HEADER).length > 0) return src;
    anywhere ??= src;
  }
  return anywhere;
}

function findIcon($: cheerio.CheerioAPI, pageUrl: string): string | null {
  return (
    httpUrl($('link[rel~="apple-touch-icon"]').first().attr('href'), pageUrl) ??
    httpUrl($('link[rel~="icon"]').first().attr('href'), pageUrl)
  );
}

function collectJsonLd(nodes: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    out.push(record);
    if (record['@graph']) visit(record['@graph']);
  };
  visit(nodes);
  return out;
}

export function parsePage(html: string, pageUrl: string): ParsedPage {
  const $ = cheerio.load(html);

  const jsonLdRaw: unknown[] = [];
  let jsonLdBytes = 0;
  $('script[type="application/ld+json"]').each((_, element) => {
    const text = $(element).text();
    jsonLdBytes += text.length;
    if (jsonLdBytes > MAX_JSON_LD_BYTES) return;
    try {
      jsonLdRaw.push(JSON.parse(text));
    } catch {
      // Malformed JSON-LD is common; skip the block rather than fail the page.
    }
  });

  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"], meta[property^="product:"]').each((_, element) => {
    const key = $(element).attr('property');
    const content = $(element).attr('content');
    if (key && content) openGraph[key] = normalizeWhitespace(content);
  });

  const links = new Set<string>();
  const emails = new Set<string>();
  const phones = new Set<string>();
  const socials = new Map<string, { provider: SocialProviderName; url: string }>();
  $('a[href]').each((_, element) => {
    const href = ($(element).attr('href') ?? '').trim();
    if (/^mailto:/i.test(href)) {
      const email = decodeURIComponent(href.slice(7).split('?')[0] ?? '').trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) && !SKIP_EXTENSIONS.test(email)) emails.add(email);
      return;
    }
    if (/^tel:/i.test(href)) {
      const phone = decodeURIComponent(href.slice(4)).replace(/[^\d+]/g, '');
      if (phone.replace(/\D/g, '').length >= 8) phones.add(phone);
      return;
    }
    const absolute = canonicalize(href, pageUrl);
    if (!absolute) return;
    const social = socialFrom(new URL(href, pageUrl).toString());
    if (social) socials.set(`${social.provider}:${social.url}`, social);
    if (!SKIP_EXTENSIONS.test(absolute)) links.add(absolute);
  });

  const images: { src: string; alt: string }[] = [];
  $('img').each((_, element) => {
    if (images.length >= MAX_IMAGES) return;
    const raw = ($(element).attr('src') ?? $(element).attr('data-src') ?? '').trim();
    const alt = normalizeWhitespace($(element).attr('alt') ?? '');
    if (!raw || raw.startsWith('data:') || /\.svg(\?|$)/i.test(raw) || alt.length < 3) return;
    try {
      const url = new URL(raw, pageUrl);
      if (url.protocol === 'http:' || url.protocol === 'https:') images.push({ src: url.toString(), alt });
    } catch {
      // An unparseable image address is simply not used.
    }
  });

  const canonical = canonicalize($('link[rel="canonical"]').attr('href') ?? '', pageUrl);
  // Before the header and nav are stripped for text extraction below.
  const logoUrl = findLogo($, pageUrl);
  const iconUrl = findIcon($, pageUrl);

  $('script, style, noscript, svg, iframe, template, canvas').remove();
  const { text, footerText } = extractText($);

  const currency =
    openGraph['og:price:currency'] ??
    openGraph['product:price:currency'] ??
    /Shopify\.currency\s*=\s*\{"active":"([A-Z]{3})"/.exec(html)?.[1] ??
    null;

  const platformHints: string[] = [];
  if (/cdn\.shopify\.com|Shopify\.theme/i.test(html)) platformHints.push('shopify');
  if (/wp-content\/plugins\/woocommerce|woocommerce-/i.test(html)) platformHints.push('woocommerce');
  if (/wp-content|wp-includes/i.test(html)) platformHints.push('wordpress');
  if (/wixstatic\.com/i.test(html)) platformHints.push('wix');
  if (/static1\.squarespace\.com/i.test(html)) platformHints.push('squarespace');

  return {
    url: pageUrl,
    canonicalUrl: canonical ?? canonicalize(pageUrl) ?? pageUrl,
    title: normalizeWhitespace($('title').first().text()) || null,
    description:
      normalizeWhitespace($('meta[name="description"]').attr('content') ?? '') ||
      openGraph['og:description'] ||
      null,
    language: ($('html').attr('lang') ?? '').split('-')[0]?.toLowerCase() || null,
    openGraph,
    jsonLd: collectJsonLd(jsonLdRaw),
    links: [...links],
    images,
    logoUrl,
    iconUrl,
    emails: [...emails],
    phones: [...phones],
    socials: [...socials.values()],
    text,
    footerText,
    textHash: createHash('sha256').update(text).digest('hex'),
    currency,
    platformHints,
  };
}
