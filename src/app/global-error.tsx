'use client';

import { useEffect } from 'react';

const RELOAD_KEY = 'limiance:chunk-recovery';
const RELOAD_WINDOW_MS = 30_000;

function isChunkError(error: Error) {
  const text = `${error.name} ${error.message}`.toLowerCase();
  return text.includes('chunkloaderror') || text.includes('failed to load chunk') || text.includes('loading chunk');
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!isChunkError(error)) return;

    const previous = Number(sessionStorage.getItem(RELOAD_KEY) ?? '0');
    if (Date.now() - previous > RELOAD_WINDOW_MS) {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
    }
  }, [error]);

  const retry = () => {
    sessionStorage.removeItem(RELOAD_KEY);
    window.location.reload();
  };

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#08090d', color: '#f4f5f7', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
          <section>
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>This page could not load</h1>
            <p style={{ color: '#a8adb8', marginBottom: 20 }}>The app encountered a temporary loading error.</p>
            <button
              type="button"
              onClick={retry}
              style={{ background: '#3b82f6', color: '#fff', border: 0, borderRadius: 6, padding: '10px 18px', cursor: 'pointer', fontWeight: 600 }}
            >
              Reload page
            </button>
            <button
              type="button"
              onClick={reset}
              style={{ background: 'transparent', color: '#a8adb8', border: 0, padding: '10px 18px', cursor: 'pointer' }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
