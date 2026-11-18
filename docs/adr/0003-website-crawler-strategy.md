# ADR 0003: Own crawler (fetch + Cheerio + platform adapters) behind CrawlerPort

Status: accepted, 2026-11-13.

## Context
Website scanning is the core onboarding feature. Options: Firecrawl (hosted), Crawl4AI (self-hosted Python), Playwright, or our own fetch plus Cheerio.

## Decision
- v1 is our own crawler in `modules/memory/knowledge`, behind `CrawlerPort`: HTTP fetch, robots.txt and sitemap discovery, Cheerio parsing, JSON-LD and Open Graph extraction.
- Add platform adapters, which give better data than generic scraping: Shopify `/products.json`, WooCommerce Store API, schema.org Product and LocalBusiness. Most Indian SMB sites run on these platforms.
- No third-party crawling service in v1: customer URLs and page content stay in our infrastructure, there is no per-page vendor cost, and SSRF controls are ours to enforce and test. Cost: we maintain the fetcher.
- SSRF guard is mandatory: http and https only, resolve DNS then connect to the resolved IP, reject private, loopback, link-local and metadata ranges, re-validate every redirect, cap redirects, page count, bytes per page and total time.
- Escape hatch: a `HeadlessCrawlerAdapter` (Playwright, run in the worker only) is added by a new ADR when the measured rate of empty or JS-only pages exceeds about 15 percent of scans. A Firecrawl adapter would also need its own ADR covering data-processing terms.

## Consequences
- JS-only sites give partial results at first; the review screen and questionnaire cover the gap.
- Adapters are contract-tested against recorded fixtures (CLAUDE.md testing rules).

## Implementation note (2026-11-13)
v1 shipped with `cheerio@1.0.0` as the only new dependency. Extraction is deterministic (structured data and platform APIs); LLM extraction is deferred behind the same candidate shape.

## Firecrawl trial (2026-11-16): not adopted
We built a test-only Firecrawl adapter and compared it with our crawler on a real site whose products were missing (aayushwellness.com): 14 s against 0.2 s, 6 percent more text, 2 more images, 70 links in both, and the same products found. The missing products were not a rendering problem (the other product tabs are not in the page even when rendered, and the store link is not a plain link), so rendering did not help. We removed the adapter. Script-built sites (single-page apps, Wix) remain the open case; revisit a rendering fallback, with its own data-processing review, only if measured empty-page rates justify it.
