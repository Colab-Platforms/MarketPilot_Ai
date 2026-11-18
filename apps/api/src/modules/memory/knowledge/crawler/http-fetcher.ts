import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import { CrawlerPort, FetchError, type FetchedResource, type FetchOptions } from './crawler.port';
import { assertFetchableUrl, BlockedUrlError, guardedLookup } from './ssrf';

const MAX_REDIRECTS = 4;
const DEFAULT_MAX_BYTES = 1_500_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = 'MarketPilotBot/1.0';
const TEXT_TYPES = /^(text\/|application\/(json|ld\+json|xml|xhtml\+xml|rss\+xml))/i;

interface FetcherSettings {
  // For tests that talk to a local server. Never set in production wiring.
  allowPrivateNetworks?: boolean;
}

export class HttpFetcher extends CrawlerPort {
  constructor(private readonly settings: FetcherSettings = {}) {
    super();
  }

  async fetch(rawUrl: string, options: FetchOptions = {}): Promise<FetchedResource> {
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const signal = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let current = rawUrl;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const url = this.check(current);
      const response = await this.send(url, options.accept ?? 'text/html,application/json;q=0.9', signal);
      const status = response.statusCode ?? 0;
      const location = response.headers.location;

      if (status >= 300 && status < 400 && location) {
        response.resume();
        current = new URL(location, url).toString();
        continue;
      }
      const contentType = String(response.headers['content-type'] ?? '');
      if (contentType && !TEXT_TYPES.test(contentType)) {
        response.destroy();
        throw new FetchError('unsupported_type', `Unsupported content type ${contentType}`);
      }
      const { body, truncated } = await readBody(response, maxBytes, signal);
      return { url: url.toString(), status, contentType, body, truncated };
    }
    throw new FetchError('network', 'Too many redirects');
  }

  private check(raw: string): URL {
    try {
      if (this.settings.allowPrivateNetworks) return new URL(raw);
      return assertFetchableUrl(raw);
    } catch (error) {
      if (error instanceof BlockedUrlError) throw new FetchError('blocked', error.message);
      throw new FetchError('blocked', 'Not a valid URL');
    }
  }

  private send(url: URL, accept: string, signal: AbortSignal): Promise<IncomingMessage> {
    const makeRequest = url.protocol === 'https:' ? httpsRequest : httpRequest;
    return new Promise((resolve, reject) => {
      const req = makeRequest(
        url,
        {
          method: 'GET',
          signal,
          headers: { 'user-agent': USER_AGENT, accept, 'accept-encoding': 'gzip, br, deflate' },
          // Validates the resolved IP at connect time, which also covers redirects.
          ...(this.settings.allowPrivateNetworks ? {} : { lookup: guardedLookup }),
        },
        resolve,
      );
      req.on('error', (error) => reject(toFetchError(error, signal)));
      req.end();
    });
  }
}

function toFetchError(error: unknown, signal: AbortSignal): FetchError {
  if (error instanceof FetchError) return error;
  if (signal.aborted) return new FetchError('timeout', 'The site took too long to respond');
  if (error instanceof BlockedUrlError || (error as { cause?: unknown })?.cause instanceof BlockedUrlError) {
    return new FetchError('blocked', 'This address is not public');
  }
  return new FetchError('network', error instanceof Error ? error.message : 'Network error');
}

async function readBody(
  response: IncomingMessage,
  maxBytes: number,
  signal: AbortSignal,
): Promise<{ body: string; truncated: boolean }> {
  const encoding = String(response.headers['content-encoding'] ?? '').toLowerCase();
  const decoder =
    encoding === 'gzip' ? createGunzip() : encoding === 'br' ? createBrotliDecompress() : encoding === 'deflate' ? createInflate() : null;
  const source = decoder ? response.pipe(decoder) : response;
  decoder?.on('error', () => response.destroy());

  const chunks: Buffer[] = [];
  let size = 0;
  let truncated = false;
  try {
    for await (const chunk of source as AsyncIterable<Buffer>) {
      size += chunk.length;
      // The cap applies after decompression, so a small zip bomb cannot expand past it.
      if (size > maxBytes) {
        chunks.push(chunk.subarray(0, chunk.length - (size - maxBytes)));
        truncated = true;
        break;
      }
      chunks.push(chunk);
    }
  } catch (error) {
    throw toFetchError(error, signal);
  } finally {
    response.destroy();
  }
  return { body: new TextDecoder('utf-8').decode(Buffer.concat(chunks)), truncated };
}
