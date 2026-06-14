import { create } from 'zustand';
import type { SortOption } from '@/lib/types';

export type FeedFilter = 'forYou' | 'new' | 'trending' | 'following';

interface FeedStore {
  activeFilter: FeedFilter;
  activeSort: SortOption;
  activeTags: string[];
  setFilter: (filter: FeedFilter) => void;
  setSort: (sort: SortOption) => void;
  toggleTag: (tag: string) => void;
  clearTags: () => void;
}

export const useFeedStore = create<FeedStore>((set) => ({
  activeFilter: 'forYou',
  activeSort: 'marketCap',
  activeTags: [],

  setFilter: (filter) => set({ activeFilter: filter }),
  setSort: (sort) => set({ activeSort: sort }),

  toggleTag: (tag) =>
    set((state) => ({
      activeTags: state.activeTags.includes(tag)
        ? state.activeTags.filter((t) => t !== tag)
        : [...state.activeTags, tag],
    })),

  clearTags: () => set({ activeTags: [] }),
}));
