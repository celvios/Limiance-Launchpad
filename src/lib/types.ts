/* ── Token Data Types ──
 * These types define the data contract between frontend and API.
 * When Forge delivers real endpoints, these stay unchanged.
 * Only the fetch functions in api.ts need to change.
 */

export type CurveType = 'sigmoid';
export type TokenStatus = 'active' | 'graduated';

export interface TokenCardData {
  tokenAddress?: string;
  mint: string;
  symbol: string;
  name: string;
  imageUri: string;
  description: string;
  creatorWallet: string;
  creatorHandle: string;
  creatorPicUri?: string | null;
  createdAt: number; // unix ms
  curveType: CurveType;
  price: number; // USDT
  priceChange24h: number; // percentage, e.g. 142 = +142%
  marketCap: number; // USDT
  sparklineData: number[]; // 7 data points
  currentSupply: number;
  graduationThreshold: number;
  commentCount: number;
  watchCount?: number;
  status: TokenStatus;
  holderCount: number;
  volume24h: number; // USDT
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
  sort?: SortOption;
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
  platformFee: number; // percentage, e.g. 3 = 3%
  totalRaised: number; // USDT
  dexPoolAddress: string | null; // set after graduation
}

export interface CurveParams {
  type: CurveType;
  pMin?: number;
  pMax?: number;
  midpoint?: number;
  // Legacy aliases kept temporarily for existing components during migration.
  a?: number;
  b?: number;
  c?: number;
  r?: number;
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
  paymentAmount?: number;
  solAmount: number; // legacy alias for payment amount
  txSignature: string;
  timestamp: number;
  isWhale: boolean;
  pricePerToken?: number;
}

export type HomeActivityType = 'buy' | 'sell' | 'launch' | 'comment' | 'follow' | 'watch';

export interface HomeActivity {
  id: string;
  type: HomeActivityType;
  timestamp: number;
  walletAddress: string;
  username: string | null;
  tokenMint: string | null;
  tokenSymbol: string | null;
  tokenName: string | null;
  amount?: number;
  usdt?: number;
  followingWallet?: string;
  followingUsername?: string | null;
}

export interface ChartDataPoint {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  value: number; // for area chart — same as close
  volume?: number;
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
  initialBuyAmount: number; // Amount of tokens creator wants to buy initially

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
  tokenAddress: string;
  saleAddress?: string;
  mint: string;
  txSignature: string;
}

export interface DepositAddress {
  userId?: string | null;
  userWallet: string;
  chainId: number;
  asset: string;
  vaultAddress: string;
  status: 'active' | 'disabled';
  createdAt: number;
}

export interface Deposit {
  id: string;
  vaultAddress: string;
  userWallet: string;
  asset: string;
  amount: string;
  txHash: string;
  confirmations: number;
  credited: boolean;
  consumed: boolean;
  createdAt: number;
}

export interface UserBalance {
  userId?: string | null;
  walletAddress: string;
  asset: string;
  available: string;
  consumed: string;
}

/* ── Phase 5: Social Layer ── */

export type CommentSort = 'top' | 'new';
export type ProfileTab = 'created' | 'holdings' | 'trades' | 'comments';

export interface Comment {
  id: string;
  tokenMint: string;
  parentId?: string | null;
  walletAddress: string;
  walletHandle: string | null;
  profilePicUri?: string | null;
  text: string;
  likeCount?: number;
  dislikeCount?: number;
  viewerReaction?: 'like' | 'dislike' | null;
  replyCount?: number;
  replies?: Comment[];
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
  profilePicUri?: string | null;
  coverUri?: string | null;
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
  costBasis: number;
  value: number; // USDT
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


