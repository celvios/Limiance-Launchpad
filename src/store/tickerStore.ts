import { create } from 'zustand';

export interface TradeEvent {
  id: string;
  type: 'buy' | 'sell';
  tokenMint: string;
  tokenSymbol: string;
  amount: number;
  solAmount: number;
  walletAddress: string;
  txSignature: string;
  timestamp: number;
  isWhale: boolean;
}

export interface GraduationEvent {
  type: 'graduation';
  tokenMint: string;
  tokenSymbol: string;
  timestamp: number;
  totalRaised: number;
}

export type WsStatus = 'connected' | 'disconnected' | 'reconnecting';

const MAX_TRADES = 100;

interface TickerStore {
  trades: TradeEvent[];
  wsStatus: WsStatus;
  addTrade: (trade: TradeEvent) => void;
  setWsStatus: (status: WsStatus) => void;
  clearTrades: () => void;
}

export const useTickerStore = create<TickerStore>((set) => ({
  trades: [],
  wsStatus: 'disconnected',

  addTrade: (trade) =>
    set((state) => {
      const updated = [trade, ...state.trades];
      if (updated.length > MAX_TRADES) {
        updated.length = MAX_TRADES;
      }
      return { trades: updated };
    }),

  setWsStatus: (status) => set({ wsStatus: status }),

  clearTrades: () => set({ trades: [] }),
}));
