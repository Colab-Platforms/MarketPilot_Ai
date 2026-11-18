import { lookup as dnsLookup } from 'node:dns';
import { BlockList, isIP, type LookupFunction } from 'node:net';

export class BlockedUrlError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'BlockedUrlError';
  }
}

// Everything that is not a routable public unicast address.
const nonPublic = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  nonPublic.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  nonPublic.addSubnet(network, prefix, 'ipv6');
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  // BlockList also matches IPv4-mapped IPv6 (::ffff:10.0.0.1) against the IPv4 rules.
  return !nonPublic.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa'];

// Checks everything knowable before connecting. DNS results are checked separately
// in `guardedLookup`, at connect time, so a hostname cannot resolve differently
// between the check and the connection.
export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError('Not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError('Only http and https are allowed');
  }
  if (url.username || url.password) throw new BlockedUrlError('URLs with credentials are not allowed');
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new BlockedUrlError('Only the standard web ports are allowed');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new BlockedUrlError('This address is not public');
  }
  // Literal IPs skip DNS, so they are checked here.
  if (isIP(host) !== 0 && !isPublicAddress(host)) throw new BlockedUrlError('This address is not public');
  if (isIP(host) === 0 && !host.includes('.')) throw new BlockedUrlError('This address is not public');
  return url;
}

export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '', 4);
    const list = Array.isArray(addresses) ? addresses : [];
    if (list.length === 0 || list.some((entry) => !isPublicAddress(entry.address))) {
      return callback(new BlockedUrlError('This address is not public'), '', 4);
    }
    if (options.all) return callback(null, list);
    const [first] = list;
    return callback(null, first!.address, first!.family);
  });
};
