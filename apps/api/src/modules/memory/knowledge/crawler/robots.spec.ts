import { CrawlerPort, FetchError, type FetchedResource } from './crawler.port';
import { loadRobots, parseRobots } from './robots';

const SAMPLE = `
# comment
User-agent: *
Disallow: /admin
Disallow: /cart
Allow: /admin/public
Disallow: /*?session=
Disallow: /private$

User-agent: MarketPilotBot
Disallow: /internal
`;

describe('parseRobots', () => {
  it('uses the group for our agent when present, ignoring the * group', () => {
    const rules = parseRobots(SAMPLE);
    expect(rules.isAllowed('/internal/x')).toBe(false);
    expect(rules.isAllowed('/admin')).toBe(true);
  });

  it('applies the * group otherwise, with longest match and allow overrides', () => {
    const rules = parseRobots(SAMPLE.replace(/MarketPilotBot/g, 'OtherBot'));
    expect(rules.isAllowed('/admin/settings')).toBe(false);
    expect(rules.isAllowed('/admin/public/page')).toBe(true);
    expect(rules.isAllowed('/cart')).toBe(false);
    expect(rules.isAllowed('/products/x?session=1')).toBe(false);
    expect(rules.isAllowed('/private')).toBe(false);
    expect(rules.isAllowed('/private/more')).toBe(true);
    expect(rules.isAllowed('/about')).toBe(true);
  });

  it('treats an empty Disallow as allow-all', () => {
    expect(parseRobots('User-agent: *\nDisallow:').isAllowed('/anything')).toBe(true);
  });

  it('blocks everything for Disallow: /', () => {
    expect(parseRobots('User-agent: *\nDisallow: /').isAllowed('/about')).toBe(false);
  });
});

function crawlerReturning(result: Partial<FetchedResource> | Error): CrawlerPort {
  return {
    fetch: async () => {
      if (result instanceof Error) throw result;
      return { url: '', status: 200, contentType: 'text/plain', body: '', truncated: false, ...result };
    },
  };
}

describe('loadRobots (RFC 9309 status handling)', () => {
  it('allows everything when robots.txt does not exist', async () => {
    expect((await loadRobots(crawlerReturning({ status: 404 }), 'https://a.example')).isAllowed('/x')).toBe(true);
  });

  it('blocks everything when robots.txt is unreachable or errors', async () => {
    expect((await loadRobots(crawlerReturning({ status: 503 }), 'https://a.example')).isAllowed('/x')).toBe(false);
    expect(
      (await loadRobots(crawlerReturning(new FetchError('timeout', 'slow')), 'https://a.example')).isAllowed('/x'),
    ).toBe(false);
  });

  it('parses a served robots.txt', async () => {
    const rules = await loadRobots(crawlerReturning({ body: 'User-agent: *\nDisallow: /secret' }), 'https://a.example');
    expect(rules.isAllowed('/secret')).toBe(false);
    expect(rules.isAllowed('/open')).toBe(true);
  });
});
