import type { Metadata } from 'next';
import { TokenPageClient } from '@/components/token/TokenPageClient';

interface TokenPageProps {
  params: Promise<{ mint: string }>;
}

export async function generateMetadata({ params }: TokenPageProps): Promise<Metadata> {
  const { mint } = await params;

  return {
    title: `Token ${mint.slice(0, 8)}... — LAUNCH`,
    description: `View and trade this token on LAUNCH — Solana bonding curve launchpad`,
    openGraph: {
      title: `Token on LAUNCH`,
      description: `View and trade on LAUNCH — Solana bonding curve launchpad`,
      images: [`/api/og/${mint}`],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Token on LAUNCH`,
      description: `View and trade on LAUNCH — Solana bonding curve launchpad`,
      images: [`/api/og/${mint}`],
    },
  };
}

export default function TokenPage() {
  return <TokenPageClient />;
}
