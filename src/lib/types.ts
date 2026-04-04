/* ── Token Data Types ──
 * These types define the data contract between frontend and API.
 * When Forge delivers real endpoints, these stay unchanged.
 * Only the fetch functions in api.ts need to change.
 */

export type CurveType = 'linear' | 'exponential' | 'sigmoid';
export type TokenStatus = 'active' | 'graduated';

export interface TokenCardData {
  mint: string;
  symbol: string;
  name: string;
  imageUri: string;
  description: string;
  creatorWallet: string;
  creatorHandle: string;
  createdAt: number; // unix ms
  curveType: CurveType;
  price: number; // SOL
  priceChange24h: number; // percentage, e.g. 142 = +142%
  marketCap: number; // SOL
  sparklineData: number[]; // 7 data points
  currentSupply: number;
  graduationThreshold: number;
  commentCount: number;
  status: TokenStatus;
  holderCount: number;
  volume24h: number; // SOL
}

/* Paginated response shape — matches what the real API will return */
export interface TokenListResponse {
  tokens: TokenCardData[];
  nextCursor: string | null;
  total: number;
}

/* Feed filter & sort types */
export type FeedFilter = 'forYou' | 'new' | 'trending' | 'following';
export type ExploreFilter = 'all' | 'new' | 'trending' | 'nearGraduation' | 'graduated';
export type SortOption = 'marketCap' | 'volume24h' | 'age' | 'holders';

export interface FeedQueryParams {
  filter: FeedFilter;
  tags: string[];
  cursor?: string;
  limit?: number;
}

export interface ExploreQueryParams {
  filter: ExploreFilter;
  sort: SortOption;
  cursor?: string;
  limit?: number;
}

/* ── Phase 3: Token Detail ── */

export interface TokenDetail extends TokenCardData {
  bannerUri: string;
  totalSupply: number;
  basePrice: number;
  curveParams: CurveParams;
  platformFee: number; // percentage, e.g. 1 = 1%
  totalRaised: number; // SOL
  raydiumPoolAddress: string | null; // set after graduation
}

export interface CurveParams {
  type: CurveType;
  // Linear: price = a + b * supply
  a?: number;
  b?: number;
  // Exponential: price = a * e^(r * supply)
  r?: number;
  // Sigmoid: price = maxPrice / (1 + e^(-k * (supply - s0)))
  maxPrice?: number;
  k?: number;
  s0?: number;
}

export interface TradeActivity {
  id: string;
  type: 'buy' | 'sell';
  walletAddress: string;
  walletHandle: string | null;
  tokenAmount: number;
  solAmount: number;
  txSignature: string;
  timestamp: number;
  isWhale: boolean;
}

export interface ChartDataPoint {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  value: number; // for area chart — same as close
}

export type ChartTimeRange = '1H' | '4H' | '1D' | 'ALL';

/* ── Phase 4: Create Token Wizard ── */

export type CreateTokenStep = 0 | 1 | 2;

export interface CreateTokenFormData {
  // Step 1 — Identity
  imageFile: File | null;
  imagePreviewUrl: string;
  imageIpfsUri: string;
  name: string;
  symbol: string;
  description: string;
  totalSupply: number;
  creatorAllocation: number; // 0–10 percentage

  // Step 2 — Curve
  curveType: CurveType;
  curveParams: CurveParams;
  graduationThreshold: number; // percentage of total supply (e.g. 80 = 80%)
}

export interface CreateTokenValidation {
  name: string | null;
  symbol: string | null;
  image: string | null;
  totalSupply: string | null;
  description: string | null;
}

export interface DeployResult {
  success: boolean;
  mint: string;
  txSignature: string;
}

/* ── Phase 5: Social Layer ── */

export type CommentSort = 'top' | 'new';
export type ProfileTab = 'created' | 'holdings' | 'trades' | 'comments';

export interface Comment {
  id: string;
  tokenMint: string;
  walletAddress: string;
  walletHandle: string | null;
  text: string;
  upvotes: number;
  hasUpvoted: boolean; // relative to current user
  timestamp: number;
}

export interface CommentListResponse {
  comments: Comment[];
  total: number;
}

export interface UserProfile {
  walletAddress: string;
  username: string | null;
  bio: string | null;
  joinedAt: number;
  tokensCreated: number;
  followerCount: number;
  followingCount: number;
  graduatedCount: number;
  isFollowing: boolean; // relative to current user
  isOwnProfile: boolean;
}

export interface HoldingData {
  mint: string;
  symbol: string;
  name: string;
  amount: number;
  avgBuyPrice: number;
  currentPrice: number;
  pnlPercent: number;
  value: number; // SOL
}

export interface ProfileHoldingsResponse {
  holdings: HoldingData[];
}

export interface ProfileTradesResponse {
  trades: TradeActivity[];
  nextCursor: string | null;
}

export interface ProfileCommentsResponse {
  comments: (Comment & { tokenSymbol: string })[];
}
