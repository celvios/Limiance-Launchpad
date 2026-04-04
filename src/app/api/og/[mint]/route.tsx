import { ImageResponse } from '@vercel/og';
import { MOCK_TOKENS } from '@/lib/mockData';
import { getTokenDetail } from '@/lib/mockData';

export const runtime = 'edge';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;

  // In production, fetch from real API
  const card = MOCK_TOKENS.find((t) => t.mint === mint);
  if (!card) {
    return new Response('Token not found', { status: 404 });
  }

  const token = getTokenDetail(card);
  const supplyPercent = Math.round(
    (token.currentSupply / token.graduationThreshold) * 100
  );
  const priceStr =
    token.price < 0.001
      ? token.price.toFixed(6)
      : token.price < 1
      ? token.price.toFixed(4)
      : token.price.toFixed(2);
  const change = token.priceChange24h;
  const changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#0A0A0A',
          padding: '60px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Left: Token image placeholder */}
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: 24,
            background: '#181818',
            border: '2px solid #222222',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 96,
            color: '#666666',
            flexShrink: 0,
          }}
        >
          {token.symbol.slice(0, 2)}
        </div>

        {/* Right: Info */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginLeft: 48,
            flex: 1,
            justifyContent: 'space-between',
          }}
        >
          {/* Top section */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 72,
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: 3,
                lineHeight: 1,
              }}
            >
              {token.name}
            </div>
            <div
              style={{
                fontSize: 36,
                color: '#666666',
                marginTop: 8,
                letterSpacing: 1,
              }}
            >
              ${token.symbol}
            </div>

            {/* Price + Change */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 24,
                marginTop: 32,
              }}
            >
              <div style={{ fontSize: 48, color: '#FFFFFF', fontWeight: 600 }}>
                {priceStr} SOL
              </div>
              <div
                style={{
                  fontSize: 32,
                  color: change >= 0 ? '#00FF66' : '#FF2D55',
                  fontWeight: 600,
                }}
              >
                {changeStr}
              </div>
            </div>
          </div>

          {/* Supply bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                width: '100%',
                height: 16,
                borderRadius: 8,
                background: '#222222',
                display: 'flex',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${supplyPercent}%`,
                  height: '100%',
                  borderRadius: 8,
                  background: supplyPercent >= 75 ? '#FFE500' : '#00FF66',
                }}
              />
            </div>
            <div style={{ fontSize: 24, color: '#666666' }}>
              {supplyPercent}% to graduation ·{' '}
              {token.status === 'graduated'
                ? 'Graduated to Raydium'
                : `${token.currentSupply.toLocaleString()} / ${token.graduationThreshold.toLocaleString()}`}
            </div>
          </div>

          {/* Bottom branding */}
          <div style={{ fontSize: 20, color: '#444444', letterSpacing: 2 }}>
            LAUNCH · Built on Solana
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
