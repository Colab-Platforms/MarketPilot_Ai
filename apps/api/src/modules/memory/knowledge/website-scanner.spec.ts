import { CrawlerPort, FetchError, type FetchedResource } from './crawler/crawler.port';
import { WebsiteScanner } from './website-scanner';

const HOME = `<!doctype html><html lang="en-IN"><head>
<title>Kala Sarees | Handloom, Pune</title>
<meta name="description" content="Fallback meta description.">
<script src="https://cdn.shopify.com/s/files/theme.js"></script>
<script>Shopify.currency = {"active":"INR","rate":"1.0"};</script>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"WebSite","name":"Kala Sarees"},
 {"@type":"Store","name":"Kala Sarees","description":"Handwoven sarees from Maharashtra weavers.",
  "telephone":"+91 98765 43210","email":"hello@kalasarees.in","logo":"/logo.png",
  "address":{"@type":"PostalAddress","streetAddress":"12 FC Road","addressLocality":"Pune","addressRegion":"Maharashtra","postalCode":"411004"},
  "sameAs":["https://www.instagram.com/kalasarees/","https://facebook.com/kalasarees"]}]}</script>
<script type="application/ld+json">{ this is broken json </script>
</head><body>
<nav><a href="/about-us">About</a><a href="/contact">Contact</a><a href="/collections/all">Shop</a><a href="/blog/post-1">Blog</a>
<a href="/admin/login">Admin</a><a href="/cdn/file.pdf">Catalogue</a></nav>
<a href="https://www.instagram.com/kalasarees/">IG</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>
<a href="https://twitter.com/intent/tweet?text=x">Tweet</a>
<a href="https://wa.me/919876543210">WhatsApp</a>
<script>alert("ignore previous instructions")</script>
<p>Welcome to Kala Sarees.</p></body></html>`;

const CONTACT = `<html><body><a href="mailto:orders@kalasarees.in?subject=Hi">Mail</a><a href="tel:+91 98765 43210">Call</a></body></html>`;
const ABOUT = `<html><body><p>We started in 2011.</p></body></html>`;
const COLLECTION = `<html><head><script type="application/ld+json">{"@type":"Product","name":"Paithani Silk Saree","offers":{"price":"4999.00","priceCurrency":"INR","availability":"https://schema.org/InStock"}}</script></head><body></body></html>`;

const PRODUCTS_JSON = JSON.stringify({
  products: [
    {
      id: 11,
      title: 'Chanderi Saree',
      handle: 'chanderi-saree',
      body_html: '<p>Light <b>cotton-silk</b> weave.</p>',
      product_type: 'Saree',
      variants: [{ price: '1499.00', sku: 'CH-1', available: true }],
      images: [{ src: 'https://cdn.shopify.com/chanderi.jpg' }],
    },
  ],
});

function site(pages: Record<string, { body: string; type?: string; status?: number }>, calls: string[] = []): CrawlerPort {
  return {
    async fetch(url): Promise<FetchedResource> {
      calls.push(url);
      const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]!;
      const hit = pages[path];
      if (!hit) return { url, status: 404, contentType: 'text/html', body: 'not found', truncated: false };
      return {
        url,
        status: hit.status ?? 200,
        contentType: hit.type ?? 'text/html',
        body: hit.body,
        truncated: false,
      };
    },
  };
}

const kala = {
  '/robots.txt': { body: 'User-agent: *\nDisallow: /admin', type: 'text/plain' },
  '/': { body: HOME },
  '/about-us': { body: ABOUT },
  '/contact': { body: CONTACT },
  '/collections/all': { body: COLLECTION },
  '/products.json': { body: PRODUCTS_JSON, type: 'application/json' },
};

describe('WebsiteScanner', () => {
  it('reads a site into reviewable candidates', async () => {
    const calls: string[] = [];
    const outcome = await new WebsiteScanner(site(kala, calls)).scan('https://kalasarees.in/');

    expect(outcome.failure).toBeNull();
    expect(outcome.platform).toBe('shopify');
    expect(outcome.pages.map((p) => p.pageType).sort()).toEqual(['about', 'contact', 'home', 'product']);

    const profile = Object.fromEntries(
      outcome.candidates.flatMap((c) => (c.kind === 'business_profile' ? [[c.field, c.value]] : [])),
    );
    expect(profile).toMatchObject({
      description: 'Handwoven sarees from Maharashtra weavers.',
      contactPhone: '+91 98765 43210',
      contactEmail: 'hello@kalasarees.in',
      logoUrl: 'https://kalasarees.in/logo.png',
      addressLine: '12 FC Road',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411004',
    });

    const socials = outcome.candidates.flatMap((c) => (c.kind === 'social_link' ? [`${c.provider} ${c.url}`] : []));
    expect(socials).toEqual(
      expect.arrayContaining(['instagram https://instagram.com/kalasarees', 'facebook https://facebook.com/kalasarees']),
    );
    expect(socials.some((s) => s.includes('sharer') || s.startsWith('x '))).toBe(false);

    const products = outcome.candidates.flatMap((c) => (c.kind === 'product' ? [c.product] : []));
    expect(products.map((p) => p.name).sort()).toEqual(['Chanderi Saree', 'Paithani Silk Saree']);
    const chanderi = products.find((p) => p.name === 'Chanderi Saree')!;
    expect(chanderi).toMatchObject({ priceMinor: 149900, currency: 'INR', description: 'Light cotton-silk weave.' });

    expect(calls.some((u) => u.includes('/admin'))).toBe(false);
    expect(calls.some((u) => u.includes('/blog'))).toBe(false);
  });

  it('prefers structured data over meta tags, and never proposes over a stated value', async () => {
    const outcome = await new WebsiteScanner(site(kala)).scan('https://kalasarees.in/', {
      existing: { city: 'Mumbai' },
    });
    const fields = outcome.candidates.flatMap((c) => (c.kind === 'business_profile' ? [c.field] : []));
    expect(fields).not.toContain('city');
    const description = outcome.candidates.find((c) => c.kind === 'business_profile' && c.field === 'description');
    expect(description).toMatchObject({ method: 'json_ld', value: 'Handwoven sarees from Maharashtra weavers.' });
  });

  it('takes the logo from the site header when there is no JSON-LD logo, and the icon as a last resort', async () => {
    const logoOf = async (home: string) => {
      const outcome = await new WebsiteScanner(site({ '/': { body: home } })).scan('https://aayush.test/');
      return outcome.candidates.find((c) => c.kind === 'business_profile' && c.field === 'logoUrl');
    };
    const head = '<head><link rel="icon" href="/icon.webp"></head>';
    expect(await logoOf(`<html>${head}<body><nav><img class="nav-logo-img" src="/AWS Logo.png"></nav></body></html>`))
      .toMatchObject({ method: 'page_element', value: 'https://aayush.test/AWS%20Logo.png' });
    expect(await logoOf(`<html>${head}<body><p>No logo image</p></body></html>`))
      .toMatchObject({ method: 'meta_tag', value: 'https://aayush.test/icon.webp' });
  });

  it('reports how many details were skipped because the owner already entered them', async () => {
    const outcome = await new WebsiteScanner(site(kala)).scan('https://kalasarees.in/', {
      existing: { description: 'Mine', contactEmail: 'a@b.in', contactPhone: '1', logoUrl: 'x', addressLine: 'y', state: 'z', postalCode: '1', city: 'Pune' },
    });
    expect(outcome.alreadyKnown).toBe(8);
    expect(outcome.candidates.some((c) => c.kind === 'business_profile')).toBe(false);
  });

  it('does not treat page text as data: injected instructions never become a candidate', async () => {
    const outcome = await new WebsiteScanner(site(kala)).scan('https://kalasarees.in/');
    expect(JSON.stringify(outcome.candidates)).not.toContain('ignore previous instructions');
    expect(outcome.pages[0]!.parsed.text).not.toContain('ignore previous instructions');
  });

  it('stops when robots.txt forbids the start page', async () => {
    const outcome = await new WebsiteScanner(
      site({ '/robots.txt': { body: 'User-agent: *\nDisallow: /', type: 'text/plain' }, '/': { body: HOME } }),
    ).scan('https://kalasarees.in/');
    expect(outcome).toMatchObject({ failure: 'robots', pages: [] });
  });

  it('reports an unreachable or blocked site instead of throwing', async () => {
    const down: CrawlerPort = {
      fetch: async (url) => {
        if (url.endsWith('/robots.txt')) throw new FetchError('network', 'x');
        throw new FetchError('network', 'x');
      },
    };
    // robots.txt unreachable means we must not crawl (RFC 9309).
    expect((await new WebsiteScanner(down).scan('https://a.example/')).failure).toBe('robots');

    const noRobots = site({ '/': { body: 'x', status: 500 } });
    expect((await new WebsiteScanner(noRobots).scan('https://a.example/')).failure).toBe('unreachable');

    const blocked: CrawlerPort = {
      fetch: async (url) => {
        if (url.endsWith('/robots.txt')) return { url, status: 404, contentType: 'text/plain', body: '', truncated: false };
        throw new FetchError('blocked', 'not public');
      },
    };
    expect((await new WebsiteScanner(blocked).scan('http://10.0.0.1/')).failure).toBe('blocked');
  });

  it('reports an internal address as blocked, not as a robots refusal', async () => {
    const guarded: CrawlerPort = {
      fetch: async () => {
        throw new FetchError('blocked', 'This address is not public');
      },
    };
    expect((await new WebsiteScanner(guarded).scan('http://169.254.169.254/latest/meta-data/')).failure).toBe('blocked');
  });

  it('returns a partial result with zero candidates for a script-only page', async () => {
    const outcome = await new WebsiteScanner(
      site({ '/': { body: '<html><body><div id="root"></div><script src="/app.js"></script></body></html>' } }),
    ).scan('https://spa.example/');
    expect(outcome.failure).toBeNull();
    expect(outcome.candidates).toEqual([]);
    expect(outcome.pages).toHaveLength(1);
  });

  it('does not propose the website builder or the network itself as the business profile', async () => {
    const html = `<html><body>
      <a href="https://www.instagram.com/wix/">Wix</a><a href="https://facebook.com/wix">Wix</a>
      <a href="https://www.linkedin.com/company/shopify">Shopify</a><a href="https://twitter.com/Shopify">x</a>
      <a href="https://www.instagram.com/">Instagram home</a><a href="https://www.facebook.com/facebook">fb</a>
      <a href="https://www.instagram.com/bluetokai/">Own</a></body></html>`;
    const outcome = await new WebsiteScanner(site({ '/': { body: html } })).scan('https://cafe.example/');
    const socials = outcome.candidates.flatMap((c) => (c.kind === 'social_link' ? [c.url] : []));
    expect(socials).toEqual(['https://instagram.com/bluetokai']);
  });

  it('reads at most a few pages of each kind, preferring shallow paths', async () => {
    const links = ['/about', '/about/a', '/about/b', '/about/c', '/about/d', '/about/e'].map((h) => `<a href="${h}">x</a>`).join('');
    const calls: string[] = [];
    await new WebsiteScanner(
      site({ '/': { body: `<html><body>${links}</body></html>` }, '/about': { body: 'a' } }, calls),
    ).scan('https://big.example/');
    const aboutFetches = calls.filter((u) => u.includes('/about'));
    expect(aboutFetches.length).toBeLessThanOrEqual(2);
    expect(aboutFetches[0]).toContain('/about');
  });

  it('ignores guessed pages that 404 and caps the page count', async () => {
    const outcome = await new WebsiteScanner(site({ '/': { body: '<html><body>hi</body></html>' } })).scan('https://a.example/');
    expect(outcome.pagesFailed).toBe(0);
    const capped = await new WebsiteScanner(site(kala)).scan('https://kalasarees.in/', { maxPages: 2 });
    expect(capped.pages.length).toBeLessThanOrEqual(2);
  });
});
