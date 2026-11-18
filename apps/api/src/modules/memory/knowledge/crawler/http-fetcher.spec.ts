import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import { FetchError } from './crawler.port';
import { HttpFetcher } from './http-fetcher';

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    switch (req.url) {
      case '/ok':
        res.setHeader('content-type', 'text/html; charset=utf-8');
        return res.end('<html><title>Hello</title></html>');
      case '/gzip':
        res.setHeader('content-type', 'text/html');
        res.setHeader('content-encoding', 'gzip');
        return res.end(gzipSync('<p>compressed</p>'));
      case '/redirect':
        res.statusCode = 302;
        res.setHeader('location', '/ok');
        return res.end();
      case '/loop':
        res.statusCode = 302;
        res.setHeader('location', '/loop');
        return res.end();
      case '/big':
        res.setHeader('content-type', 'text/html');
        return res.end('x'.repeat(50_000));
      case '/bomb':
        res.setHeader('content-type', 'text/html');
        res.setHeader('content-encoding', 'gzip');
        return res.end(gzipSync('a'.repeat(5_000_000)));
      case '/image':
        res.setHeader('content-type', 'image/png');
        return res.end('png');
      case '/slow':
        return; // never responds
      default:
        res.statusCode = 404;
        return res.end('nope');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe('HttpFetcher (private networks allowed only for this test server)', () => {
  const fetcher = new HttpFetcher({ allowPrivateNetworks: true });

  it('fetches a page and follows redirects', async () => {
    const page = await fetcher.fetch(`${base}/redirect`);
    expect(page.status).toBe(200);
    expect(page.url).toBe(`${base}/ok`);
    expect(page.body).toContain('Hello');
  });

  it('decompresses gzip', async () => {
    expect((await fetcher.fetch(`${base}/gzip`)).body).toBe('<p>compressed</p>');
  });

  it('returns non-2xx statuses to the caller', async () => {
    expect((await fetcher.fetch(`${base}/missing`)).status).toBe(404);
  });

  it('truncates at maxBytes, including after decompression', async () => {
    const big = await fetcher.fetch(`${base}/big`, { maxBytes: 1000 });
    expect(big.truncated).toBe(true);
    expect(big.body).toHaveLength(1000);
    const bomb = await fetcher.fetch(`${base}/bomb`, { maxBytes: 10_000 });
    expect(bomb.truncated).toBe(true);
    expect(bomb.body.length).toBe(10_000);
  });

  it('gives up on redirect loops, slow servers and binary content', async () => {
    await expect(fetcher.fetch(`${base}/loop`)).rejects.toMatchObject({ reason: 'network' });
    await expect(fetcher.fetch(`${base}/slow`, { timeoutMs: 300 })).rejects.toMatchObject({ reason: 'timeout' });
    await expect(fetcher.fetch(`${base}/image`)).rejects.toMatchObject({ reason: 'unsupported_type' });
  });
});

describe('HttpFetcher with the default (production) settings', () => {
  const fetcher = new HttpFetcher();

  it.each([
    'http://127.0.0.1:1/',
    'http://localhost/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'file:///etc/passwd',
  ])('refuses %s without connecting', async (url) => {
    await expect(fetcher.fetch(url)).rejects.toBeInstanceOf(FetchError);
    await expect(fetcher.fetch(url)).rejects.toMatchObject({ reason: 'blocked' });
  });

  it('refuses a hostname that resolves to a private address', async () => {
    // localtest.me resolves to 127.0.0.1; if offline the lookup fails instead, so accept either refusal.
    await expect(fetcher.fetch('http://localtest.me/')).rejects.toBeInstanceOf(FetchError);
  });
});
