'use client';

import { useTradeTicker } from '@/hooks/useTradeTicker';
import { useGraduationHandler } from '@/hooks/useGraduationHandler';

/**
 * GlobalWSProvider — invisible component that initializes the global WebSocket
 * connection and graduation handler. Renders nothing. Mounted once in AppShell.
 */
export function GlobalWSProvider() {
  useTradeTicker();
  useGraduationHandler(null); // listen for ALL graduations globally

  return null;
}
