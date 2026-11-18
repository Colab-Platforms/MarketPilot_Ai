import { assertFetchableUrl, BlockedUrlError, isPublicAddress } from './ssrf';

describe('isPublicAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.5',
    '64:ff9b::7f00:1',
    'not-an-ip',
  ])('rejects %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])(
    'accepts %s',
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );
});

describe('assertFetchableUrl', () => {
  it('returns the parsed URL for an ordinary public site', () => {
    expect(assertFetchableUrl('https://example.com/about').hostname).toBe('example.com');
    expect(assertFetchableUrl('http://shop.example.in:80/').hostname).toBe('shop.example.in');
  });

  it.each([
    'file:///etc/passwd',
    'ftp://example.com',
    'gopher://example.com',
    'javascript:alert(1)',
    'http://localhost/',
    'http://LOCALHOST:80/',
    'http://app.localhost/',
    'http://printer.local/',
    'http://metadata.google.internal/',
    'http://intranet/',
    'http://127.0.0.1/',
    'http://127.1/',
    'http://2130706433/',
    'http://0x7f000001/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/',
    'https://user:pass@example.com/',
    'http://example.com:8080/',
    'http://example.com:22/',
    'not a url',
  ])('blocks %s', (url) => {
    expect(() => assertFetchableUrl(url)).toThrow(BlockedUrlError);
  });
});
