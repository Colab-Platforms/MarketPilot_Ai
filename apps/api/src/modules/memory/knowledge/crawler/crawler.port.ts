export interface FetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  // Comma-separated media types the caller accepts, for example "text/html".
  accept?: string;
}

export interface FetchedResource {
  // Final URL after redirects.
  url: string;
  status: number;
  contentType: string;
  body: string;
  truncated: boolean;
}

export type FetchFailure = 'blocked' | 'timeout' | 'too_large' | 'unsupported_type' | 'network';

export class FetchError extends Error {
  constructor(
    readonly reason: FetchFailure,
    message: string,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

// The only way knowledge code reaches the network. Implementations must refuse
// non-public addresses and cap time and size (ADR 0003).
export abstract class CrawlerPort {
  abstract fetch(url: string, options?: FetchOptions): Promise<FetchedResource>;
}
