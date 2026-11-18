// Where a business competes decides where to look for competitors: a Mumbai salon competes
// with Mumbai salons, but a brand selling online competes across the country.
export interface MarketSignals {
  city: string | null;
  country: string | null;
  serviceAreas: string[];
  audienceLocations: string[];
  salesChannels: string[];
  operatingModel: string | null;
  onlineStoreUrl: string | null;
}

export interface Market {
  scope: 'national' | 'local';
  // "India", or the city for a local business.
  area: string;
}

const NATIONWIDE = /\b(pan[\s-]?india|all[\s-]+(?:over[\s-]+)?india|across[\s-]+india|nation[\s-]?wide|india)\b/i;
const ONLINE_CHANNELS = new Set(['website', 'marketplace', 'instagram', 'whatsapp']);
const ONLINE_MODELS = new Set(['d2c', 'marketplace']);

function countryName(country: string | null): string {
  if (!country || /^(in|ind|india)$/i.test(country.trim())) return 'India';
  return country.trim();
}

export function marketOf(signals: MarketSignals): Market {
  const country = countryName(signals.country);
  const sellsOnline =
    Boolean(signals.onlineStoreUrl) ||
    signals.salesChannels.some((channel) => ONLINE_CHANNELS.has(channel)) ||
    ONLINE_MODELS.has(signals.operatingModel ?? '');
  const servesNationwide = [...signals.serviceAreas, ...signals.audienceLocations].some((area) => NATIONWIDE.test(area));
  if (sellsOnline || servesNationwide || !signals.city) return { scope: 'national', area: country };
  return { scope: 'local', area: signals.city };
}
