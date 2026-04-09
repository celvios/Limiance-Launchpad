/* ── Mock Token Data ──
 * Mock data for Phase 2 & 3 development.
 *
 * SWAP INSTRUCTIONS:
 * When Forge delivers real endpoints, you do NOT touch this file.
 * Instead, go to src/lib/api.ts and change `USE_MOCK = true` to false.
 * The api.ts functions will then hit real endpoints instead of this data.
 */

import type { TokenCardData, TokenDetail, TradeActivity, ChartDataPoint, CurveParams } from './types';

const NOW = Date.now();
const HOUR = 3_600_000;
const DAY = 86_400_000;

export const MOCK_TOKENS: TokenCardData[] = [
  {
    mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    symbol: 'PEPE',
    name: 'Pepe The Frog',
    imageUri: '/tokens/pepe.png',
    description: 'The original meme king. Community-driven token celebrating the most iconic internet meme of all time.',
    creatorWallet: '4f2a8b1c9d3e7f6a5b0c2d4e6f8a1b3c5d7e9f0a1b2c',
    creatorHandle: 'pepelord',
    createdAt: NOW - 3 * DAY,
    curveType: 'exponential',
    price: 0.000042,
    priceChange24h: 142.5,
    marketCap: 42000,
    sparklineData: [0.000012, 0.000018, 0.000015, 0.000024, 0.000030, 0.000038, 0.000042],
    currentSupply: 6200,
    graduationThreshold: 10000,
    commentCount: 47,
    status: 'active',
    holderCount: 342,
    volume24h: 1250,
  },
  {
    mint: '9kBZ3JmoAnGvPFKoRx7N5SaKnT3vLcXJNqTp8VwPKsZ4',
    symbol: 'MOON',
    name: 'To The Moon',
    imageUri: '/tokens/moon.png',
    description: 'Defying gravity, one token at a time. The community that never stops believing.',
    creatorWallet: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
    creatorHandle: 'moonwalker',
    createdAt: NOW - 7 * DAY,
    curveType: 'sigmoid',
    price: 0.0284,
    priceChange24h: -8.3,
    marketCap: 284000,
    sparklineData: [0.031, 0.033, 0.030, 0.029, 0.032, 0.028, 0.0284],
    currentSupply: 8500,
    graduationThreshold: 10000,
    commentCount: 128,
    status: 'active',
    holderCount: 891,
    volume24h: 8400,
  },
  {
    mint: '3aXs9oW6cY2pR4mN8bQ1jE5tH7uK0fG2iL4nP6sV8xA',
    symbol: 'FROG',
    name: 'Frog Finance',
    imageUri: '/tokens/frog.png',
    description: 'Hop into DeFi. A ribbit-ing new approach to decentralized finance on Solana.',
    creatorWallet: 'b8c1e7d3f2a5b9c4d6e0f1a7b3c8d2e5f9a0b4c6d1e3',
    creatorHandle: 'ribbitdev',
    createdAt: NOW - 30 * 60_000, // 30 min ago — NEW token
    curveType: 'linear',
    price: 0.0001,
    priceChange24h: 0,
    marketCap: 100,
    sparklineData: [0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001],
    currentSupply: 120,
    graduationThreshold: 10000,
    commentCount: 2,
    status: 'active',
    holderCount: 8,
    volume24h: 12,
  },
  {
    mint: '5dYt7uO9iP2wE4rQ6sA8fG1hJ3kL5mN7oP9qR1sT3uV',
    symbol: 'BONK',
    name: 'Bonk Token',
    imageUri: '/tokens/bonk.png',
    description: 'The dog coin of Solana. Bonk first, ask questions later. Community owned and operated.',
    creatorWallet: '9d4e2f5a8c1b7d3e6f0a4b9c5d2e8f1a3b7c0d6e4f5a',
    creatorHandle: 'bonkmaster',
    createdAt: NOW - 14 * DAY,
    curveType: 'exponential',
    price: 0.00842,
    priceChange24h: 23.7,
    marketCap: 168400,
    sparklineData: [0.006, 0.0065, 0.0072, 0.0068, 0.0075, 0.0080, 0.00842],
    currentSupply: 9200,
    graduationThreshold: 10000,
    commentCount: 312,
    status: 'active',
    holderCount: 1245,
    volume24h: 15600,
  },
  {
    mint: '2bXr4wZ6yA8cE0gI2kM4oQ6sU8wY0aD2fH4jL6nP8rT',
    symbol: 'GRAD',
    name: 'The Graduate',
    imageUri: '/tokens/grad.png',
    description: 'First token to graduate on the platform. Now trading on Raydium. A piece of history.',
    creatorWallet: 'c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5',
    creatorHandle: 'pioneer',
    createdAt: NOW - 21 * DAY,
    curveType: 'sigmoid',
    price: 0.0562,
    priceChange24h: 5.2,
    marketCap: 562000,
    sparklineData: [0.048, 0.050, 0.053, 0.055, 0.054, 0.058, 0.0562],
    currentSupply: 10000,
    graduationThreshold: 10000,
    commentCount: 567,
    status: 'graduated',
    holderCount: 2341,
    volume24h: 34200,
  },
  {
    mint: '8gNq0sW2yE4rT6uI8oP0aS2dF4gH6jK8lZ0xC2vB4nM',
    symbol: 'SIGMA',
    name: 'Sigma Protocol',
    imageUri: '/tokens/sigma.png',
    description: 'Sigmoid curve pioneer. Designed for fair distribution with mathematically optimal price discovery.',
    creatorWallet: 'd7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9',
    creatorHandle: 'sigmabrain',
    createdAt: NOW - 5 * DAY,
    curveType: 'sigmoid',
    price: 0.00156,
    priceChange24h: 67.8,
    marketCap: 15600,
    sparklineData: [0.0008, 0.0009, 0.0010, 0.0011, 0.0013, 0.0014, 0.00156],
    currentSupply: 3200,
    graduationThreshold: 10000,
    commentCount: 34,
    status: 'active',
    holderCount: 156,
    volume24h: 890,
  },
  {
    mint: '4hOr1tX3zA5cE7gI9lN1oQ3sU5wY7aD9fH1jL3nP5rT',
    symbol: 'WHALE',
    name: 'Whale Watch',
    imageUri: '/tokens/whale.png',
    description: 'Track the whales, ride the waves. Community analytics token for Solana DeFi.',
    creatorWallet: 'e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3',
    creatorHandle: 'whalewatcher',
    createdAt: NOW - 2 * DAY,
    curveType: 'linear',
    price: 0.00034,
    priceChange24h: -15.2,
    marketCap: 3400,
    sparklineData: [0.00045, 0.00042, 0.00040, 0.00038, 0.00036, 0.00035, 0.00034],
    currentSupply: 1800,
    graduationThreshold: 10000,
    commentCount: 18,
    status: 'active',
    holderCount: 67,
    volume24h: 230,
  },
  {
    mint: '6jPt3vY5bG7cE9iK1mO3qS5uW7yA9dF1hJ3lN5pR7tV',
    symbol: 'DEGEN',
    name: 'Degen Labs',
    imageUri: '/tokens/degen.png',
    description: 'For the degens, by the degens. High-risk, high-reward experimental tokenomics.',
    creatorWallet: 'f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7',
    creatorHandle: 'degenlord',
    createdAt: NOW - 1 * DAY,
    curveType: 'exponential',
    price: 0.00789,
    priceChange24h: 234.1,
    marketCap: 78900,
    sparklineData: [0.002, 0.003, 0.0035, 0.004, 0.005, 0.0065, 0.00789],
    currentSupply: 4500,
    graduationThreshold: 10000,
    commentCount: 89,
    status: 'active',
    holderCount: 423,
    volume24h: 5670,
  },
  {
    mint: '1kQu4wZ6cH8dF0jL2nP4rT6vX8zA0dF2hJ4lN6pR8tV',
    symbol: 'SOL69',
    name: 'Solana Sixty Nine',
    imageUri: '/tokens/sol69.png',
    description: 'The nicest number on Solana. Community vibes token. No utility, just good energy.',
    creatorWallet: 'a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1',
    creatorHandle: 'nice420',
    createdAt: NOW - 45 * 60_000, // 45 min ago — NEW
    curveType: 'linear',
    price: 0.00005,
    priceChange24h: 12.0,
    marketCap: 50,
    sparklineData: [0.00004, 0.00004, 0.00004, 0.00005, 0.00005, 0.00005, 0.00005],
    currentSupply: 80,
    graduationThreshold: 10000,
    commentCount: 5,
    status: 'active',
    holderCount: 12,
    volume24h: 8,
  },
  {
    mint: '2lRv5xA7dI9eG1kM3oQ5sU7wY9bE1gI3kM5oQ7sU9wY',
    symbol: 'ALPHA',
    name: 'Alpha Seekers',
    imageUri: '/tokens/alpha.png',
    description: 'Finding alpha before the crowd. Research-driven community token for serious traders.',
    creatorWallet: 'b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5',
    creatorHandle: 'alphatrader',
    createdAt: NOW - 10 * DAY,
    curveType: 'sigmoid',
    price: 0.0145,
    priceChange24h: -3.1,
    marketCap: 145000,
    sparklineData: [0.015, 0.0155, 0.0148, 0.0142, 0.0140, 0.0143, 0.0145],
    currentSupply: 7800,
    graduationThreshold: 10000,
    commentCount: 203,
    status: 'active',
    holderCount: 678,
    volume24h: 6780,
  },
  {
    mint: '3mSw6yB8eJ0fH2lN4pR6tV8xZ0cF2hJ4lN6pR8tV0xZ',
    symbol: 'NEAR',
    name: 'Near Graduation',
    imageUri: '/tokens/near.png',
    description: 'Almost there! This token is on the verge of graduating to Raydium. Final push!',
    creatorWallet: 'c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9',
    creatorHandle: 'almostthere',
    createdAt: NOW - 12 * DAY,
    curveType: 'exponential',
    price: 0.0398,
    priceChange24h: 18.9,
    marketCap: 398000,
    sparklineData: [0.032, 0.034, 0.035, 0.036, 0.037, 0.038, 0.0398],
    currentSupply: 9400,
    graduationThreshold: 10000,
    commentCount: 445,
    status: 'active',
    holderCount: 1876,
    volume24h: 22300,
  },
  {
    mint: '4nTx7zC9fK1gI3mO5qS7uW9yA1dF3hJ5lN7pR9tV1xZ',
    symbol: 'CATS',
    name: 'CatCoin Solana',
    imageUri: '/tokens/cats.png',
    description: 'Cats rule the internet. Now they rule Solana too. Meow money, meow problems.',
    creatorWallet: 'd1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3',
    creatorHandle: 'catperson',
    createdAt: NOW - 4 * DAY,
    curveType: 'linear',
    price: 0.00092,
    priceChange24h: 45.3,
    marketCap: 9200,
    sparklineData: [0.0005, 0.0006, 0.0006, 0.0007, 0.0008, 0.0009, 0.00092],
    currentSupply: 2100,
    graduationThreshold: 10000,
    commentCount: 56,
    status: 'active',
    holderCount: 189,
    volume24h: 1340,
  },
  {
    mint: '5oUy8aD0gL2hJ4nP6rT8vX0zA2eG4iK6mO8qS0uW2yA',
    symbol: 'VIBE',
    name: 'Good Vibes Only',
    imageUri: '/tokens/vibe.png',
    description: 'Pure positive energy on the blockchain. No FUD allowed. Community-curated content.',
    creatorWallet: 'e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7',
    creatorHandle: 'goodvibes',
    createdAt: NOW - 6 * DAY,
    curveType: 'exponential',
    price: 0.00267,
    priceChange24h: 12.8,
    marketCap: 26700,
    sparklineData: [0.0022, 0.0023, 0.0024, 0.0023, 0.0025, 0.0026, 0.00267],
    currentSupply: 3800,
    graduationThreshold: 10000,
    commentCount: 71,
    status: 'active',
    holderCount: 234,
    volume24h: 1890,
  },
  {
    mint: '6pVz9bE1hM3iK5oQ7sU9wY1aD3fH5jL7nP9rT1vX3zA',
    symbol: 'GIGA',
    name: 'GigaChad Token',
    imageUri: '/tokens/giga.png',
    description: 'For the absolute units. Exponential curve because GigaChads only go up.',
    creatorWallet: 'f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1',
    creatorHandle: 'gigachad',
    createdAt: NOW - 20 * 60_000, // 20 min ago — NEW
    curveType: 'exponential',
    price: 0.00008,
    priceChange24h: 0,
    marketCap: 80,
    sparklineData: [0.00008, 0.00008, 0.00008, 0.00008, 0.00008, 0.00008, 0.00008],
    currentSupply: 45,
    graduationThreshold: 10000,
    commentCount: 1,
    status: 'active',
    holderCount: 3,
    volume24h: 4,
  },
  {
    mint: '7qWa0cF2iN4jL6pR8tV0xZ2bG4hJ6lN8pR0tV2xZ4bG',
    symbol: 'GRAIL',
    name: 'Holy Grail',
    imageUri: '/tokens/grail.png',
    description: 'The holy grail of Solana tokens. Graduated and thriving on Raydium DEX.',
    creatorWallet: 'a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5',
    creatorHandle: 'grailseeker',
    createdAt: NOW - 30 * DAY,
    curveType: 'linear',
    price: 0.0891,
    priceChange24h: 2.1,
    marketCap: 891000,
    sparklineData: [0.082, 0.084, 0.086, 0.085, 0.088, 0.087, 0.0891],
    currentSupply: 10000,
    graduationThreshold: 10000,
    commentCount: 892,
    status: 'graduated',
    holderCount: 4521,
    volume24h: 56700,
  },
];

/* Featured tokens — curated subset for the feed featured row */
export const FEATURED_MINTS = [
  '5dYt7uO9iP2wE4rQ6sA8fG1hJ3kL5mN7oP9qR1sT3uV', // BONK — high activity
  '3mSw6yB8eJ0fH2lN4pR6tV8xZ0cF2hJ4lN6pR8tV0xZ', // NEAR — near graduation
  '2bXr4wZ6yA8cE0gI2kM4oQ6sU8wY0aD2fH4jL6nP8rT', // GRAD — graduated
  '6jPt3vY5bG7cE9iK1mO3qS5uW7yA9dF1hJ3lN5pR7tV', // DEGEN — hot
  '9kBZ3JmoAnGvPFKoRx7N5SaKnT3vLcXJNqTp8VwPKsZ4', // MOON — sigmoid curve
];

/* ── Phase 3 Mock Data ── */

const CURVE_PARAMS_MAP: Record<string, CurveParams> = {
  linear: { type: 'linear', a: 0.0001, b: 0.000005 },
  exponential: { type: 'exponential', a: 0.00001, r: 0.0008 },
  sigmoid: { type: 'sigmoid', maxPrice: 0.1, k: 0.002, s0: 5000 },
};

/* Extend TokenCardData → TokenDetail with extra fields */
export function getTokenDetail(card: TokenCardData): TokenDetail {
  return {
    ...card,
    bannerUri: '',
    totalSupply: card.graduationThreshold,
    basePrice: card.sparklineData[0] ?? 0.0001,
    curveParams: CURVE_PARAMS_MAP[card.curveType] ?? CURVE_PARAMS_MAP.linear,
    platformFee: 1,
    totalRaised: card.marketCap * 0.15,
    raydiumPoolAddress:
      card.status === 'graduated'
        ? 'RAY' + card.mint.slice(0, 30) + 'pool'
        : null,
  };
}

/* Generate mock trade history for a token */
const MOCK_WALLETS = [
  { address: '4f2a8b1c9d3e7f6a5b0c2d4e6f8a1b3c5d7e9f0a1b2c', handle: 'pepelord' },
  { address: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2', handle: 'moonwalker' },
  { address: 'b8c1e7d3f2a5b9c4d6e0f1a7b3c8d2e5f9a0b4c6d1e3', handle: null },
  { address: '9d4e2f5a8c1b7d3e6f0a4b9c5d2e8f1a3b7c0d6e4f5a', handle: 'bonkmaster' },
  { address: 'c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5', handle: null },
  { address: 'd7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9', handle: 'sigmabrain' },
  { address: 'e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3', handle: 'whalewatcher' },
  { address: 'f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7', handle: 'degenlord' },
];

export function generateMockTrades(mint: string, count: number = 20): TradeActivity[] {
  const trades: TradeActivity[] = [];
  const token = MOCK_TOKENS.find((t) => t.mint === mint);
  const basePrice = token?.price ?? 0.001;

  for (let i = 0; i < count; i++) {
    const isBuy = Math.random() > 0.4;
    const wallet = MOCK_WALLETS[i % MOCK_WALLETS.length];
    const tokenAmount = Math.floor(100 + Math.random() * 5000);
    const solAmount = parseFloat((tokenAmount * basePrice * (0.8 + Math.random() * 0.4)).toFixed(4));
    const isWhale = solAmount > 50;

    trades.push({
      id: `trade-${mint.slice(0, 6)}-${i}`,
      type: isBuy ? 'buy' : 'sell',
      walletAddress: wallet.address,
      walletHandle: wallet.handle,
      tokenAmount,
      solAmount,
      txSignature: `${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`,
      timestamp: NOW - i * (60_000 + Math.random() * 300_000),
      isWhale,
    });
  }

  return trades;
}

/* Generate mock chart data for a token */
export function generateMockChartData(
  token: TokenCardData,
  range: '1H' | '4H' | '1D' | 'ALL'
): ChartDataPoint[] {
  const points: ChartDataPoint[] = [];
  const currentPrice = token.price;
  const basePrice = token.sparklineData[0] ?? currentPrice * 0.5;

  let count: number;
  let interval: number; // seconds

  switch (range) {
    case '1H':
      count = 60;
      interval = 60;
      break;
    case '4H':
      count = 48;
      interval = 300;
      break;
    case '1D':
      count = 96;
      interval = 900;
      break;
    case 'ALL':
    default:
      count = 100;
      interval = Math.floor(
        (NOW / 1000 - (token.createdAt / 1000)) / 100
      ) || 3600;
      break;
  }

  const nowSeconds = Math.floor(NOW / 1000);
  const startTime = nowSeconds - count * interval;

  for (let i = 0; i < count; i++) {
    const progress = i / count;
    const trend = basePrice + (currentPrice - basePrice) * progress;
    const noise = trend * (0.95 + Math.random() * 0.1);
    const open = i === 0 ? basePrice : points[i - 1].close;
    const close = noise;
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);

    points.push({
      time: startTime + i * interval,
      open,
      high,
      low,
      close,
      value: close,
    });
  }

  return points;
}

/* ── Phase 5: Social Mock Data ── */

import type { Comment, UserProfile, HoldingData } from './types';

const MOCK_COMMENT_TEXTS = [
  'This token is going to the moon! 🚀',
  'The curve on this one is really well designed.',
  'Bought a bag, lets see where this goes.',
  'Creator is based, been following their work.',
  'Interesting tokenomics. The sigmoid curve gives a fair launch.',
  'Who else is aping in?',
  'Price impact still low, good entry point.',
  'Chart looking bullish af',
  'Supply almost at graduation threshold 👀',
  'Just sold half my position, taking profits.',
  'Curve math checks out. This is legit.',
  'Huge buy just came through, whale alert!',
  'Community is growing fast, bullish signal.',
  'First token I bought on this platform, LFG!',
  'The graduation mechanism is genius.',
  'Diamond hands only 💎🙌',
  'Devs are active, good sign.',
  'Waiting for a dip to load up more.',
  'Already up 300% from my entry, insane.',
  'This is going to graduate soon, mark my words.',
];

export function generateMockComments(
  mint: string,
  sort: 'top' | 'new' = 'new'
): Comment[] {
  const comments: Comment[] = [];
  const count = 8 + Math.floor(mint.charCodeAt(0) % 12); // 8–19 comments

  for (let i = 0; i < count; i++) {
    const wallet = MOCK_WALLETS[i % MOCK_WALLETS.length];
    const textIndex = (mint.charCodeAt(i % mint.length) + i) % MOCK_COMMENT_TEXTS.length;
    const upvotes = Math.floor(Math.pow(Math.random() * 10, 2));

    comments.push({
      id: `comment-${mint.slice(0, 6)}-${i}`,
      tokenMint: mint,
      walletAddress: wallet.address,
      walletHandle: wallet.handle,
      text: MOCK_COMMENT_TEXTS[textIndex],
      upvotes,
      hasUpvoted: Math.random() > 0.7,
      timestamp: NOW - i * (120_000 + Math.random() * 600_000),
    });
  }

  if (sort === 'top') {
    comments.sort((a, b) => b.upvotes - a.upvotes);
  } else {
    comments.sort((a, b) => b.timestamp - a.timestamp);
  }

  return comments;
}

export function getMockProfile(walletAddress: string): UserProfile {
  const wallet = MOCK_WALLETS.find((w) => w.address === walletAddress);
  const createdTokens = MOCK_TOKENS.filter((t) => t.creatorWallet === walletAddress);
  const graduated = createdTokens.filter((t) => t.status === 'graduated');

  return {
    walletAddress,
    username: wallet?.handle ?? null,
    bio: wallet?.handle
      ? `Building on Solana. Creator of ${createdTokens.length} token${createdTokens.length !== 1 ? 's' : ''}.`
      : null,
    joinedAt: NOW - (42 + walletAddress.charCodeAt(0)) * DAY,
    tokensCreated: createdTokens.length,
    followerCount: 50 + walletAddress.charCodeAt(0) * 3,
    followingCount: 10 + walletAddress.charCodeAt(1) * 2,
    graduatedCount: graduated.length,
    isFollowing: Math.random() > 0.5,
    isOwnProfile: false, // overridden by hook when comparing connected wallet
  };
}

export function getMockProfileTokens(walletAddress: string): TokenCardData[] {
  return MOCK_TOKENS.filter((t) => t.creatorWallet === walletAddress);
}

export function getMockHoldings(walletAddress: string): HoldingData[] {
  // Simulate holdings — pick a subset of tokens
  const holdingCount = 2 + (walletAddress.charCodeAt(0) % 5);
  const holdings: HoldingData[] = [];

  for (let i = 0; i < holdingCount && i < MOCK_TOKENS.length; i++) {
    const token = MOCK_TOKENS[(walletAddress.charCodeAt(i % walletAddress.length) + i) % MOCK_TOKENS.length];
    const amount = Math.floor(100 + Math.random() * 5000);
    const avgBuy = token.price * (0.5 + Math.random() * 0.5);
    const pnl = ((token.price - avgBuy) / avgBuy) * 100;

    holdings.push({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      amount,
      avgBuyPrice: avgBuy,
      currentPrice: token.price,
      pnlPercent: pnl,
      value: amount * token.price,
    });
  }

  return holdings;
}

export function getMockProfileTrades(walletAddress: string): TradeActivity[] {
  // Generate trades for this wallet across multiple tokens
  const trades: TradeActivity[] = [];
  const wallet = MOCK_WALLETS.find((w) => w.address === walletAddress) ?? MOCK_WALLETS[0];

  for (let i = 0; i < 15; i++) {
    const token = MOCK_TOKENS[i % MOCK_TOKENS.length];
    const isBuy = Math.random() > 0.4;
    const tokenAmount = Math.floor(100 + Math.random() * 5000);
    const solAmount = parseFloat((tokenAmount * token.price * (0.8 + Math.random() * 0.4)).toFixed(4));

    trades.push({
      id: `ptrade-${walletAddress.slice(0, 6)}-${i}`,
      type: isBuy ? 'buy' : 'sell',
      walletAddress: wallet.address,
      walletHandle: wallet.handle,
      tokenAmount,
      solAmount,
      txSignature: `${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`,
      timestamp: NOW - i * (300_000 + Math.random() * 900_000),
      isWhale: solAmount > 50,
    });
  }

  return trades.sort((a, b) => b.timestamp - a.timestamp);
}

export function getMockProfileComments(
  walletAddress: string
): (Comment & { tokenSymbol: string })[] {
  const results: (Comment & { tokenSymbol: string })[] = [];

  for (let i = 0; i < 6; i++) {
    const token = MOCK_TOKENS[i % MOCK_TOKENS.length];
    const textIndex = (walletAddress.charCodeAt(i) + i) % MOCK_COMMENT_TEXTS.length;

    results.push({
      id: `pcomment-${walletAddress.slice(0, 6)}-${i}`,
      tokenMint: token.mint,
      tokenSymbol: token.symbol,
      walletAddress,
      walletHandle: MOCK_WALLETS.find((w) => w.address === walletAddress)?.handle ?? null,
      text: MOCK_COMMENT_TEXTS[textIndex],
      upvotes: Math.floor(Math.random() * 20),
      hasUpvoted: false,
      timestamp: NOW - i * (600_000 + Math.random() * 1_800_000),
    });
  }

  return results;
}

