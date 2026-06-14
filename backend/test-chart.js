const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const trade = await prisma.trade.findFirst({
    orderBy: { timestamp: 'desc' },
  });
  if (!trade) return console.log('No trades found');
  
  const mint = trade.tokenMint;
  console.log('Testing mint:', mint);

  const trades = await prisma.trade.findMany({
    where: { tokenMint: mint },
    orderBy: { timestamp: 'asc' },
    select: { timestamp: true, pricePerToken: true, solAmount: true }
  });

  const bucketSec = 86400; // ALL range
  const bucketMap = new Map();

  for (const t of trades) {
    const unixSec = Math.floor(t.timestamp.getTime() / 1000);
    const bucketTime = Math.floor(unixSec / bucketSec) * bucketSec;
    const p = t.pricePerToken;

    if (!bucketMap.has(bucketTime)) {
      bucketMap.set(bucketTime, { time: bucketTime, open: p, high: p, low: p, close: p, volume: 0n });
    }
    const b = bucketMap.get(bucketTime);
    b.close = p; 
    if (p > b.high) b.high = p;
    if (p < b.low) b.low = p;
    b.volume += t.solAmount;
  }

  const sortedBuckets = Array.from(bucketMap.values()).sort((a, b) => a.time - b.time);
  
  const startSec = Math.floor(new Date(0).getTime() / 1000);
  const windowStartBucketTime = Math.floor(startSec / bucketSec) * bucketSec;

  const firstBucketTime = sortedBuckets.length > 0 ? sortedBuckets[0].time : windowStartBucketTime;

  const nowSec = Math.floor(Date.now() / 1000);
  const currentBucketTime = Math.floor(nowSec / bucketSec) * bucketSec;
  const lastBucketTime = sortedBuckets.length > 0 
    ? Math.max(sortedBuckets[sortedBuckets.length - 1].time, currentBucketTime)
    : currentBucketTime;

  const filledBuckets = [];
  let previousClose = trades.length > 0 ? trades[0].pricePerToken : 0n;
  
  for (let time = firstBucketTime; time <= lastBucketTime; time += bucketSec) {
    const bucket = bucketMap.get(time);
    if (bucket) {
      filledBuckets.push(bucket);
      previousClose = bucket.close;
    } else {
      filledBuckets.push({
        time,
        open: previousClose,
        high: previousClose,
        low: previousClose,
        close: previousClose,
        volume: 0n,
      });
    }
  }

  const formatPrice = (p) => Number(p) < 1e10 ? Number(p) / 1e6 : Number(p) / 1e18;

  const data = filledBuckets.map((b) => ({
    time: b.time,
    open: formatPrice(b.open),
    high: formatPrice(b.high),
    low: formatPrice(b.low),
    close: formatPrice(b.close),
    value: formatPrice(b.close),
    volume: Number(b.volume) / 1e6, 
  }));

  console.log('Result length:', data.length);
  for (let d of data) {
      console.log(new Date(d.time * 1000).toISOString().split('T')[0], d.close);
  }
}
main();
