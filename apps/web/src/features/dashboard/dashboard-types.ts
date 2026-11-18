import type { DataPoint } from '@marketpilot/ui';

export type DashboardRange = '7d' | '30d' | '90d';
export type Channel = 'instagram' | 'facebook' | 'whatsapp';
export type PostFormat = 'Reel' | 'Image' | 'Carousel' | 'Text';

export interface Kpi {
  id: 'reach' | 'interactions' | 'followers' | 'posts';
  label: string;
  value: number;
  // Change against the previous period of the same length, as a fraction (0.12 = +12%).
  delta: number;
  trend: number[];
  hint: string;
}

export interface ChannelShare {
  channel: Channel;
  reach: number;
  posts: number;
}

export interface UpcomingPost {
  id: string;
  title: string;
  channel: Channel;
  format: PostFormat;
  scheduledFor: Date;
}

export interface PendingApproval {
  id: string;
  caption: string;
  channel: Channel;
  format: PostFormat;
  proposedFor: Date;
}

export interface TopPost {
  id: string;
  caption: string;
  channel: Channel;
  format: PostFormat;
  reach: number;
  engagementRate: number;
}

export interface DashboardData {
  isSample: boolean;
  kpis: Kpi[];
  reach: DataPoint[];
  bestDays: DataPoint[];
  channels: ChannelShare[];
  upNext: UpcomingPost[];
  approvals: PendingApproval[];
  topPosts: TopPost[];
}
