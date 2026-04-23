/* ── API Abstraction Layer ──
 *
 * HOW TO SWAP TO REAL ENDPOINTS:
 * 1. Set USE_MOCK = false (or use env: NEXT_PUBLIC_USE_MOCK_DATA)
 * 2. Implement the fetch functions in the `// ── Real API ──` section
 * 3. That's it. No component changes needed.
 *
 * All components consume data through hooks (useTokenFeed, etc.)
 * which call these functions. The response shapes are identical
 * whether data comes from mock or real API.
 */

import { MOCK_TOKENS, FEATURED_MINTS, getTokenDetail, generateMockTrades, generateMockChartData } from './mockData';
import { API_BASE_URL } from './constants';
import type {
  TokenCardData,
  TokenDetail,
  TokenListResponse,
  TradeActivity,
  ChartDataPoint,
  ChartTimeRange,
  FeedQueryParams,
  ExploreQueryParams,
  ExploreFilter,
  SortOption,
} from './types';

/* ── Toggle ── */
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== 'false';

/* ── Helpers ── */
const HOUR = 3_600_000;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* ── Mock Implementations ── */

function mockFeedTokens(params: FeedQueryParams): TokenListResponse {
  const { filter, tags, cursor, limit = 6 } = params;
  let filtered = [...MOCK_TOKENS];

  // Apply filter
  switch (filter) {
    case 'new':
      filtered = filtered.filter(
        (t) => Date.now() - t.createdAt < 24 * HOUR
      );
      break;
    case 'trending':
      filtered = filtered
        .filter((t) => t.status === 'active')
        .sort((a, b) => b.volume24h - a.volume24h);
      break;
    case 'following':
      // No follow data in mock — return empty
      filtered = [];
      break;
    case 'forYou':
    default:
      // Default sort: mix of recency + activity
      filtered = filtered.sort((a, b) => {
        const scoreA = a.volume24h * 0.6 + (1 / (Date.now() - a.createdAt)) * 1e12 * 0.4;
        const scoreB = b.volume24h * 0.6 + (1 / (Date.now() - b.createdAt)) * 1e12 * 0.4;
        return scoreB - scoreA;
      });
      break;
  }

  // Apply tag filters
  if (tags.includes('sigmoid')) {
    filtered = filtered.filter((t) => t.curveType === 'sigmoid');
  }
  if (tags.includes('near-grad')) {
    filtered = filtered.filter(
      (t) => t.currentSupply / t.graduationThreshold > 0.75 && t.status === 'active'
    );
  }
  if (tags.includes('new')) {
    filtered = filtered.filter((t) => Date.now() - t.createdAt < HOUR);
  }

  // Paginate
  const startIndex = cursor ? parseInt(cursor, 10) : 0;
  const page = filtered.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < filtered.length;

  return {
    tokens: page,
    nextCursor: hasMore ? String(startIndex + limit) : null,
    total: filtered.length,
  };
}

function mockExploreTokens(params: ExploreQueryParams): TokenListResponse {
  const { filter, sort, cursor, limit = 24 } = params;
  let filtered = [...MOCK_TOKENS];

  // Apply filter
  const filterMap: Record<ExploreFilter, (t: TokenCardData) => boolean> = {
    all: () => true,
    new: (t) => Date.now() - t.createdAt < 24 * HOUR,
    trending: (t) => t.status === 'active' && t.volume24h > 500,
    nearGraduation: (t) =>
      t.currentSupply / t.graduationThreshold > 0.75 && t.status === 'active',
    graduated: (t) => t.status === 'graduated',
  };

  filtered = filtered.filter(filterMap[filter]);

  // Apply sort
  const sortMap: Record<SortOption, (a: TokenCardData, b: TokenCardData) => number> = {
    marketCap: (a, b) => b.marketCap - a.marketCap,
    volume24h: (a, b) => b.volume24h - a.volume24h,
    age: (a, b) => b.createdAt - a.createdAt,
    holders: (a, b) => b.holderCount - a.holderCount,
  };

  filtered = filtered.sort(sortMap[sort]);

  // Paginate
  const startIndex = cursor ? parseInt(cursor, 10) : 0;
  const page = filtered.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < filtered.length;

  return {
    tokens: page,
    nextCursor: hasMore ? String(startIndex + limit) : null,
    total: filtered.length,
  };
}

function mockFeaturedTokens(): TokenCardData[] {
  return FEATURED_MINTS.map(
    (mint) => MOCK_TOKENS.find((t) => t.mint === mint)
  ).filter((t): t is TokenCardData => t !== undefined);
}

/* ── Public API Functions ── */

export async function fetchFeedTokens(
  params: FeedQueryParams
): Promise<TokenListResponse> {
  if (USE_MOCK) {
    await delay(600); // Simulate network latency
    return mockFeedTokens(params);
  }

  // ── Real API ──
  // Map frontend filter names to backend-accepted enum values
  const filterMap: Record<string, string> = {
    forYou: 'new',
    new: 'new',
    trending: 'trending',
    near_grad: 'near_grad',
    graduated: 'graduated',
    following: 'following',
  };
  const searchParams = new URLSearchParams({
    filter: filterMap[params.filter] ?? 'new',
    ...(params.cursor && { cursor: params.cursor }),
    ...(params.limit && { limit: String(params.limit) }),
  });
  params.tags.forEach((tag) => searchParams.append('tag', tag));

  const res = await fetch(`${API_BASE_URL}/tokens?${searchParams.toString()}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<TokenListResponse>;
}

export async function fetchExploreTokens(
  params: ExploreQueryParams
): Promise<TokenListResponse> {
  if (USE_MOCK) {
    await delay(400);
    return mockExploreTokens(params);
  }

  // ── Real API ──
  // Backend has no /tokens/explore — use /tokens with filter mapping
  const filterMap: Record<string, string> = {
    all: 'new',
    new: 'new',
    trending: 'trending',
    nearGraduation: 'near_grad',
    graduated: 'graduated',
  };
  const searchParams = new URLSearchParams({
    filter: filterMap[params.filter] ?? 'new',
    ...(params.cursor && { cursor: params.cursor }),
    ...(params.limit && { limit: String(params.limit) }),
  });

  const res = await fetch(`${API_BASE_URL}/tokens?${searchParams.toString()}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  // Wrap to match TokenListResponse shape
  const data = await res.json() as TokenListResponse;
  return data;
}

export async function fetchFeaturedTokens(): Promise<TokenCardData[]> {
  if (USE_MOCK) {
    await delay(300);
    return mockFeaturedTokens();
  }

  // ── Real API ──
  // Backend has no /tokens/featured — use trending tokens as "featured"
  const res = await fetch(`${API_BASE_URL}/tokens?filter=trending&limit=6`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json() as { tokens: TokenCardData[] };
  return data.tokens;
}

/* ── Phase 3: Token Detail ── */

export async function fetchTokenDetail(mint: string): Promise<TokenDetail> {
  if (USE_MOCK) {
    await delay(400);
    const card = MOCK_TOKENS.find((t) => t.mint === mint);
    if (!card) throw new Error(`Token not found: ${mint}`);
    return getTokenDetail(card);
  }

  const res = await fetch(`${API_BASE_URL}/tokens/${mint}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<TokenDetail>;
}

export async function fetchTokenActivity(
  mint: string,
  cursor?: string,
  limit: number = 20
): Promise<{ trades: TradeActivity[]; nextCursor: string | null }> {
  if (USE_MOCK) {
    await delay(300);
    const allTrades = generateMockTrades(mint, 50);
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const page = allTrades.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < allTrades.length;
    return {
      trades: page,
      nextCursor: hasMore ? String(startIndex + limit) : null,
    };
  }

  const params = new URLSearchParams({
    ...(cursor && { cursor }),
    limit: String(limit),
  });
  const res = await fetch(`${API_BASE_URL}/tokens/${mint}/activity?${params}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchChartData(
  mint: string,
  range: ChartTimeRange
): Promise<ChartDataPoint[]> {
  if (USE_MOCK) {
    await delay(200);
    const card = MOCK_TOKENS.find((t) => t.mint === mint);
    if (!card) throw new Error(`Token not found: ${mint}`);
    return generateMockChartData(card, range);
  }

  const res = await fetch(`${API_BASE_URL}/tokens/${mint}/chart?range=${range}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<ChartDataPoint[]>;
}

/* ── Phase 4: Create Token ── */

export async function checkNameUniqueness(name: string): Promise<boolean> {
  if (USE_MOCK) {
    await delay(300);
    const taken = MOCK_TOKENS.some(
      (t) => t.name.toLowerCase() === name.toLowerCase()
    );
    return !taken;
  }

  const res = await fetch(
    `${API_BASE_URL}/tokens/check-name?name=${encodeURIComponent(name)}`
  );
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return (data as { available: boolean }).available;
}

export async function checkSymbolUniqueness(symbol: string): Promise<boolean> {
  if (USE_MOCK) {
    await delay(300);
    const taken = MOCK_TOKENS.some(
      (t) => t.symbol.toLowerCase() === symbol.toLowerCase()
    );
    return !taken;
  }

  const res = await fetch(
    `${API_BASE_URL}/tokens/check-symbol?symbol=${encodeURIComponent(symbol)}`
  );
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return (data as { available: boolean }).available;
}

import type { CreateTokenFormData, DeployResult } from './types';

export async function deployToken(
  data: CreateTokenFormData
): Promise<DeployResult> {
  if (USE_MOCK) {
    await delay(2000); // Simulate wallet signing + confirmation
    // Generate a fake mint address
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let mint = '';
    for (let i = 0; i < 44; i++) {
      mint += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    let txSig = '';
    for (let i = 0; i < 88; i++) {
      txSig += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return { success: true, mint, txSignature: txSig };
  }

  const res = await fetch(`${API_BASE_URL}/tokens/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      symbol: data.symbol,
      description: data.description,
      imageUri: data.imageIpfsUri,
      totalSupply: data.totalSupply,
      creatorAllocation: data.creatorAllocation,
      curveType: data.curveType,
      curveParams: data.curveParams,
      graduationThreshold: data.graduationThreshold,
    }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<DeployResult>;
}

/* ── Phase 5: Social API ── */

import {
  generateMockComments,
  getMockProfile,
  getMockProfileTokens,
  getMockHoldings,
  getMockProfileTrades,
  getMockProfileComments,
} from './mockData';
import type {
  Comment,
  CommentListResponse,
  CommentSort,
  UserProfile,
  HoldingData,
  ProfileHoldingsResponse,
  ProfileTradesResponse,
  ProfileCommentsResponse,
} from './types';

export async function fetchComments(
  mint: string,
  sort: CommentSort = 'new',
  viewer?: string
): Promise<CommentListResponse> {
  if (USE_MOCK) {
    await delay(300);
    const comments = generateMockComments(mint, sort);
    return { comments, total: comments.length };
  }

  const params = new URLSearchParams({ sort });
  if (viewer) params.set('viewer', viewer);
  const res = await fetch(`${API_BASE_URL}/tokens/${mint}/comments?${params}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<CommentListResponse>;
}

export async function postComment(
  mint: string,
  text: string,
  walletAddress: string,
  signature: string,
  timestamp: number
): Promise<Comment> {
  if (USE_MOCK) {
    await delay(500);
    return {
      id: `comment-new-${Date.now()}`,
      tokenMint: mint,
      walletAddress,
      walletHandle: null,
      text,
      upvotes: 0,
      hasUpvoted: false,
      timestamp: Date.now(),
    };
  }

  const res = await fetch(`${API_BASE_URL}/tokens/${mint}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, walletAddress, signature, timestamp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `API error: ${res.status}`);
  }
  const data = await res.json() as { comment: Comment };
  return data.comment;
}

export async function upvoteComment(
  commentId: string,
  walletAddress: string,
  signature: string,
  timestamp: number
): Promise<{ upvotes: number; hasUpvoted: boolean }> {
  if (USE_MOCK) {
    await delay(200);
    return { upvotes: Math.floor(Math.random() * 50) + 1, hasUpvoted: true };
  }

  const res = await fetch(`${API_BASE_URL}/comments/${commentId}/upvote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, signature, timestamp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `API error: ${res.status}`);
  }
  return res.json() as Promise<{ upvotes: number; hasUpvoted: boolean }>;
}

export async function fetchProfile(walletAddress: string): Promise<UserProfile> {
  if (USE_MOCK) {
    await delay(300);
    return getMockProfile(walletAddress);
  }

  const res = await fetch(`${API_BASE_URL}/profiles/${walletAddress}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<UserProfile>;
}

export async function updateProfile(
  walletAddress: string,
  data: { username?: string; bio?: string; profilePicUri?: string; coverUri?: string },
  signature: string,
  timestamp: number
): Promise<UserProfile> {
  if (USE_MOCK) {
    await delay(500);
    const profile = getMockProfile(walletAddress);
    return { ...profile, username: data.username ?? profile.username, bio: data.bio ?? profile.bio };
  }

  const res = await fetch(`${API_BASE_URL}/profiles/${walletAddress}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, walletAddress, signature, timestamp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `API error: ${res.status}`);
  }
  const body = await res.json() as { profile: UserProfile };
  return body.profile;
}

export async function followUser(
  followerWallet: string,
  followingWallet: string,
  signature: string,
  timestamp: number
): Promise<void> {
  if (USE_MOCK) {
    await delay(300);
    return;
  }

  const res = await fetch(`${API_BASE_URL}/follows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ followerWallet, followingWallet, signature, timestamp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `API error: ${res.status}`);
  }
}

export async function unfollowUser(
  followerWallet: string,
  followingWallet: string,
  signature: string,
  timestamp: number
): Promise<void> {
  if (USE_MOCK) {
    await delay(300);
    return;
  }

  const res = await fetch(`${API_BASE_URL}/follows`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ followerWallet, followingWallet, signature, timestamp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `API error: ${res.status}`);
  }
}

export async function fetchProfileTokens(
  walletAddress: string
): Promise<TokenCardData[]> {
  if (USE_MOCK) {
    await delay(300);
    return getMockProfileTokens(walletAddress);
  }

  const res = await fetch(`${API_BASE_URL}/profiles/${walletAddress}/tokens`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json() as { tokens: TokenCardData[] };
  return data.tokens ?? [];
}

export async function fetchProfileHoldings(
  walletAddress: string
): Promise<ProfileHoldingsResponse> {
  if (USE_MOCK) {
    await delay(300);
    return { holdings: getMockHoldings(walletAddress) };
  }

  const res = await fetch(`${API_BASE_URL}/profiles/${walletAddress}/holdings`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<ProfileHoldingsResponse>;
}

export async function fetchProfileTrades(
  walletAddress: string
): Promise<ProfileTradesResponse> {
  if (USE_MOCK) {
    await delay(300);
    return { trades: getMockProfileTrades(walletAddress), nextCursor: null };
  }

  const res = await fetch(`${API_BASE_URL}/profiles/${walletAddress}/trades`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<ProfileTradesResponse>;
}

export async function fetchProfileComments(
  walletAddress: string
): Promise<ProfileCommentsResponse> {
  if (USE_MOCK) {
    await delay(300);
    return { comments: getMockProfileComments(walletAddress) };
  }

  const res = await fetch(`${API_BASE_URL}/profiles/${walletAddress}/comments`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<ProfileCommentsResponse>;
}

