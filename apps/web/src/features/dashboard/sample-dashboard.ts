import type { DataPoint } from '@marketpilot/ui';
import type { DashboardData, DashboardRange, Kpi } from './dashboard-types';

// Illustrative numbers shown until a channel is connected and organic analytics (M9) report real
// ones. Every surface that renders them carries a "Sample" label (DESIGN.md: honest numbers).

const DAYS: Record<DashboardRange, number> = { '7d': 7, '30d': 30, '90d': 90 };
const DAY_MS = 86_400_000;
const dayLabel = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

// Deterministic so server and client renders agree and the charts do not jump on refetch.
function wave(i: number, seed: number): number {
  return 0.55 + 0.25 * Math.sin(i * 0.45 + seed) + 0.12 * Math.sin(i * 1.7 + seed * 2) + i * 0.004;
}

function series(length: number, base: number, seed: number): number[] {
  return Array.from({ length }, (_, i) => Math.round(base * wave(i, seed)));
}

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

function kpi(id: Kpi['id'], label: string, hint: string, days: number, base: number, seed: number): Kpi {
  const both = series(days * 2, base, seed);
  const previous = both.slice(0, days);
  const current = both.slice(days);
  const prevTotal = sum(previous);
  return {
    id,
    label,
    hint,
    value: sum(current),
    delta: prevTotal > 0 ? (sum(current) - prevTotal) / prevTotal : 0,
    trend: current,
  };
}

function reachSeries(days: number, today: Date): DataPoint[] {
  const values = series(days * 2, 1800, 1).slice(days);
  return values.map((value, i) => ({
    label: dayLabel.format(new Date(today.getTime() - (days - 1 - i) * DAY_MS)),
    value,
  }));
}

function inDays(today: Date, days: number, hour: number): Date {
  const date = new Date(today.getTime() + days * DAY_MS);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export function sampleDashboard(range: DashboardRange, today = new Date()): DashboardData {
  const days = DAYS[range];
  const reach = kpi('reach', 'People reached', 'Unique accounts that saw your posts', days, 1800, 1);
  const postsPerDay = 0.6;

  return {
    isSample: true,
    kpis: [
      reach,
      kpi('interactions', 'Interactions', 'Likes, comments, shares and saves', days, 140, 2),
      kpi('followers', 'New followers', 'Followers gained across channels', days, 18, 3),
      {
        ...kpi('posts', 'Posts published', 'Across Instagram and Facebook', days, postsPerDay * 10, 4),
        value: Math.round(days * postsPerDay),
      },
    ],
    reach: reachSeries(days, today),
    bestDays: [
      { label: 'Mon', value: 210 },
      { label: 'Tue', value: 245 },
      { label: 'Wed', value: 232 },
      { label: 'Thu', value: 268 },
      { label: 'Fri', value: 318 },
      { label: 'Sat', value: 402 },
      { label: 'Sun', value: 356 },
    ],
    channels: [
      { channel: 'instagram', reach: Math.round(reach.value * 0.62), posts: Math.round(days * 0.35) },
      { channel: 'facebook', reach: Math.round(reach.value * 0.29), posts: Math.round(days * 0.2) },
      { channel: 'whatsapp', reach: Math.round(reach.value * 0.09), posts: Math.round(days * 0.05) },
    ],
    upNext: [
      { id: 'u1', title: 'Weekend offer: 20% off first visit', channel: 'instagram', format: 'Reel', scheduledFor: inDays(today, 0, 18) },
      { id: 'u2', title: 'Meet the team behind the counter', channel: 'facebook', format: 'Image', scheduledFor: inDays(today, 1, 11) },
      { id: 'u3', title: '3 tips to get the most from your visit', channel: 'instagram', format: 'Carousel', scheduledFor: inDays(today, 2, 19) },
      { id: 'u4', title: 'New arrivals this week', channel: 'whatsapp', format: 'Text', scheduledFor: inDays(today, 3, 10) },
    ],
    approvals: [
      { id: 'a1', caption: 'Festive season is here. Book early and skip the queue this week.', channel: 'instagram', format: 'Image', proposedFor: inDays(today, 2, 12) },
      { id: 'a2', caption: 'Behind the scenes: how we prepare every order by hand.', channel: 'facebook', format: 'Reel', proposedFor: inDays(today, 4, 18) },
      { id: 'a3', caption: 'Thank you for 1,000 happy customers this year.', channel: 'instagram', format: 'Carousel', proposedFor: inDays(today, 5, 17) },
    ],
    topPosts: [
      { id: 't1', caption: 'Before and after: a customer favourite', channel: 'instagram', format: 'Reel', reach: 8420, engagementRate: 0.072 },
      { id: 't2', caption: 'Our Sunday special is back', channel: 'instagram', format: 'Image', reach: 5310, engagementRate: 0.054 },
      { id: 't3', caption: 'Answering your 5 most asked questions', channel: 'facebook', format: 'Carousel', reach: 3980, engagementRate: 0.041 },
      { id: 't4', caption: 'Store timings for the holiday week', channel: 'facebook', format: 'Text', reach: 2210, engagementRate: 0.023 },
    ],
  };
}
