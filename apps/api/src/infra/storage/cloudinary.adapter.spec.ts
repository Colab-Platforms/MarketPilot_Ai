import { CloudinaryAdapter, parseCloudinaryUrl, signParams } from './cloudinary.adapter';

const URL_ENV = 'cloudinary://123456:s3cr3t@demo-cloud';
const folder = 'marketpilot_products/w1';

describe('Cloudinary signing', () => {
  it('matches the worked example in the Cloudinary docs', () => {
    expect(signParams({ timestamp: '1315060510' }, 'abcd')).toBe('a21ad0f63beb4de2e5575204b79ab90bffb02c10');
  });

  it('sorts params by name before signing', () => {
    expect(signParams({ timestamp: '1', folder: 'a' }, 'x')).toBe(signParams({ folder: 'a', timestamp: '1' }, 'x'));
  });

  it('reads key, secret and cloud name from CLOUDINARY_URL', () => {
    expect(parseCloudinaryUrl(URL_ENV)).toEqual({ apiKey: '123456', apiSecret: 's3cr3t', cloudName: 'demo-cloud' });
  });
});

describe('CloudinaryAdapter', () => {
  const adapter = new CloudinaryAdapter(URL_ENV, () => 1_700_000_000_000);

  it('issues a ticket that signs every field except api_key and never exposes the secret', () => {
    const ticket = adapter.createUploadTicket(folder);
    expect(ticket.uploadUrl).toBe('https://api.cloudinary.com/v1_1/demo-cloud/image/upload');
    const { api_key, signature, ...signed } = ticket.fields;
    expect(api_key).toBe('123456');
    expect(signed).toEqual({ allowed_formats: 'jpg,jpeg,png,webp', folder, timestamp: '1700000000' });
    expect(signature).toBe(signParams(signed, 's3cr3t'));
    expect(JSON.stringify(ticket)).not.toContain('s3cr3t');
  });

  it.each([
    [`https://res.cloudinary.com/demo-cloud/image/upload/v1700000000/${folder}/abc.jpg`, true],
    [`https://res.cloudinary.com/demo-cloud/image/upload/${folder}/abc.webp`, true],
    [`https://res.cloudinary.com/demo-cloud/image/upload/v1/marketpilot_products/w2/abc.jpg`, false],
    [`https://res.cloudinary.com/other-cloud/image/upload/v1/${folder}/abc.jpg`, false],
    [`http://res.cloudinary.com/demo-cloud/image/upload/v1/${folder}/abc.jpg`, false],
    [`https://example.com/demo-cloud/image/upload/v1/${folder}/abc.jpg`, false],
    ['not a url', false],
  ])('ownsUrl(%s) is %s', (url, expected) => {
    expect(adapter.ownsUrl(url, folder)).toBe(expected);
  });
});
