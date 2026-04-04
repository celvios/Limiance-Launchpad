import { create } from 'zustand';

export type FeedFilter = 'forYou' | 'new' | 'trending' | 'following';

interface FeedStore {
  activeFilter: FeedFilter;
  activeTags: string[];
  setFilter: (filter: FeedFilter) => void;
  toggleTag: (tag: string) => void;
  clearTags: () => void;
}

export const useFeedStore = create<FeedStore>((set) => ({
  activeFilter: 'forYou',
  activeTags: [],

  setFilter: (filter) => set({ activeFilter: filter }),

  toggleTag: (tag) =>
    set((state) => ({
      activeTags: state.activeTags.includes(tag)
        ? state.activeTags.filter((t) => t !== tag)
        : [...state.activeTags, tag],
    })),

  clearTags: () => set({ activeTags: [] }),
}));
