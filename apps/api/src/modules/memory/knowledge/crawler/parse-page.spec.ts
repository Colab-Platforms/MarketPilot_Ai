import { parsePage } from './parse-page';

const BODY = 'We make herbal wellness gummies and shilajit drops from carefully sourced botanicals. '.repeat(4);

const page = (body: string) => `<html><body>${body}</body></html>`;

describe('parsePage logo', () => {
  const base = 'https://aayush.test/';

  it('finds a header image marked as the logo, as on sites without JSON-LD', () => {
    const { logoUrl } = parsePage(
      page(`<nav><a href="/"><img src="/AWS Logo.png" alt="Aayush Wellness Limited" class="nav-logo-img"/></a></nav>`),
      base,
    );
    expect(logoUrl).toBe('https://aayush.test/AWS%20Logo.png');
  });

  it('recognises the logo from its link wrapper', () => {
    const { logoUrl } = parsePage(page(`<header><a class="site-logo" href="/"><img src="/brand.webp"></a></header>`), base);
    expect(logoUrl).toBe('https://aayush.test/brand.webp');
  });

  it('prefers the header logo over partner logos further down the page', () => {
    const { logoUrl } = parsePage(
      page(`<main><img class="client-logo" src="/partners/acme.png"></main><header><img class="logo" src="/ours.png"></header>`),
      base,
    );
    expect(logoUrl).toBe('https://aayush.test/ours.png');
  });

  it('reads the site icon, preferring the larger apple-touch-icon', () => {
    const html = `<html><head><link rel="shortcut icon" href="/fav.ico"><link rel="apple-touch-icon" href="/touch.png"></head><body></body></html>`;
    expect(parsePage(html, base)).toMatchObject({ logoUrl: null, iconUrl: 'https://aayush.test/touch.png' });
  });
});

describe('parsePage text', () => {
  it('keeps words from adjacent elements apart', () => {
    const { text } = parsePage(page(`<main><ul><li><a href="/a">Gummies</a></li><li><a href="/b">Drops</a></li></ul><p>${BODY}</p></main>`), 'https://x.test/');
    expect(text).toContain('Gummies Drops');
  });

  it('leaves the menu and site header out of the text', () => {
    const { text } = parsePage(
      page(`<header><nav><a href="/">Home</a><a href="/about">About Us</a></nav></header><main><p>${BODY}</p></main>`),
      'https://x.test/',
    );
    expect(text).not.toContain('About Us');
    expect(text).toContain('herbal wellness gummies');
  });

  it('keeps the footer apart from the text so it is not chunked', () => {
    const { text, footerText } = parsePage(
      page(`<main><p>${BODY}</p></main><footer>Plot 4, Goregaon East, Mumbai 400063</footer>`),
      'https://x.test/',
    );
    expect(text).not.toContain('Goregaon');
    expect(footerText).toBe('Plot 4, Goregaon East, Mumbai 400063');
  });

  it('falls back to the whole page when stripping chrome would leave almost nothing', () => {
    const { text, footerText } = parsePage(page('<header><nav>Hello there small site</nav></header>'), 'https://x.test/');
    expect(text).toBe('Hello there small site');
    expect(footerText).toBe('');
  });
});
