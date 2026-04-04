import { create } from 'zustand';

interface WatchlistStore {
  watchlist: string[]; // array of mint addresses
  isWatching: (mint: string) => boolean;
  toggle: (mint: string) => void;
  count: () => number;
}

function loadWatchlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('watchlist');
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function saveWatchlist(list: string[]) {
  try {
    localStorage.setItem('watchlist', JSON.stringify(list));
  } catch {
    // localStorage unavailable
  }
}

export const useWatchlistStore = create<WatchlistStore>((set, get) => ({
  watchlist: loadWatchlist(),

  isWatching: (mint: string) => get().watchlist.includes(mint),

  toggle: (mint: string) => {
    const current = get().watchlist;
    const updated = current.includes(mint)
      ? current.filter((m) => m !== mint)
      : [...current, mint];
    saveWatchlist(updated);
    set({ watchlist: updated });
  },

  count: () => get().watchlist.length,
}));
