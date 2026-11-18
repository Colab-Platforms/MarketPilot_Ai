// The website content handed to the model, and the same text kept for checking
// the model's quotes against it afterwards.

export interface EvidencePage {
  url: string;
  pageType: string;
  title: string | null;
  description: string | null;
  // Structured data (JSON-LD), already serialised.
  structured: string;
  text: string;
  // Optional: only the product reader uses them.
  images?: { src: string; alt: string }[];
}

export interface EvidencePack {
  pages: EvidencePage[];
  // True when content had to be cut to fit the size cap.
  truncated: boolean;
}

// Hard caps so one very large site cannot make a runaway request.
export const MAX_PAGE_CHARS = 8_000;
export const MAX_HOME_CHARS = 10_000;
export const MAX_STRUCTURED_CHARS = 2_000;
export const MAX_TOTAL_CHARS = 60_000;
export const MAX_IMAGES_PER_PAGE = 30;

const PRIORITY = ['home', 'about', 'service', 'product', 'faq', 'policy', 'contact', 'other', 'blog'];

export function packEvidence(pages: EvidencePage[]): EvidencePack {
  const ordered = [...pages].sort(
    (a, b) => PRIORITY.indexOf(a.pageType) - PRIORITY.indexOf(b.pageType),
  );
  const packed: EvidencePage[] = [];
  let used = 0;
  let truncated = false;

  for (const page of ordered) {
    const budget = Math.min(page.pageType === 'home' ? MAX_HOME_CHARS : MAX_PAGE_CHARS, MAX_TOTAL_CHARS - used);
    if (budget <= 200) {
      truncated = true;
      break;
    }
    const text = page.text.length > budget ? page.text.slice(0, budget) : page.text;
    if (text.length < page.text.length) truncated = true;
    const structured = page.structured.slice(0, MAX_STRUCTURED_CHARS);
    packed.push({ ...page, text, structured, images: (page.images ?? []).slice(0, MAX_IMAGES_PER_PAGE) });
    used += text.length + structured.length;
  }
  return { pages: packed, truncated };
}

// Lower-cased, punctuation-light and whitespace-collapsed, so a quote can be found
// even if the model changed quote marks or spacing.
export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, '')
    .replace(/…|\.{3}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
