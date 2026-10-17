export type SocialAnalyticsAccountStatus =
  | "live"
  | "not_configured"
  | "profile_required"
  | "unsupported"
  | "error";

export interface SocialAnalyticsSeriesPoint {
  date: string;
  value: number;
}

export interface SocialAnalyticsMetrics {
  followers: number | null;
  following: number | null;
  postsCount: number | null;
  reach: number | null;
  views: number | null;
  impressions: number | null;
  profileViews: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagement: number | null;
  pinClicks: number | null;
  outboundClicks: number | null;
  watchTimeMinutes: number | null;
  averageViewDurationSeconds: number | null;
  metricType: string | null;
  metricLabel: string | null;
  exposureSeries: SocialAnalyticsSeriesPoint[];
}

export interface SocialAnalyticsPost {
  id: string;
  platform: string;
  caption: string | null;
  mediaType: string | null;
  permalink: string | null;
  mediaUrl: string | null;
  timestamp: string | null;
  stats: SocialAnalyticsPostStats | null;
}

export interface SocialAnalyticsPostStats {
  views: number | null;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  favorites: number | null;
}

export interface SocialAnalyticsAccount {
  id: number;
  platform: string;
  accountName: string;
  profileUsername: string | null;
  profileHandle: string | null;
  description: string | null;
  status: SocialAnalyticsAccountStatus;
  statusMessage: string | null;
  directConnectionStatus: string | null;
  directConnectionProvider: string | null;
  directConnectionLastValidatedAt: string | null;
  directConnectionError: string | null;
  metrics: SocialAnalyticsMetrics | null;
  recentPosts: SocialAnalyticsPost[];
}

export interface SocialAnalyticsSummary {
  totalAccounts: number;
  profileReadyAccounts: number;
  liveAccounts: number;
  errorAccounts: number;
  unsupportedAccounts: number;
  totalFollowers: number;
  totalReach: number;
  totalViews: number;
  totalEngagement: number;
  totalPosts: number;
}

export interface SocialAnalyticsData {
  configured: boolean;
  fetchedAt: string;
  days: number;
  summary: SocialAnalyticsSummary;
  exposureSeries: SocialAnalyticsSeriesPoint[];
  accounts: SocialAnalyticsAccount[];
}

export interface SocialAnalyticsPostsPage {
  accountId: number;
  posts: SocialAnalyticsPost[];
  hasMore: boolean;
  nextCursor: string | null;
}
