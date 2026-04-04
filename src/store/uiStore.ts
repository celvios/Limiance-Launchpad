import { create } from 'zustand';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

interface UIStore {
  isWalletDrawerOpen: boolean;
  isOnboardingOpen: boolean;
  activeModal: string | null;
  toasts: Toast[];
  isSidebarCollapsed: boolean;
  openWalletDrawer: () => void;
  closeWalletDrawer: () => void;
  setOnboardingOpen: (open: boolean) => void;
  openModal: (id: string) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  toggleSidebar: () => void;
}

let toastCounter = 0;

export const useUIStore = create<UIStore>((set) => ({
  isWalletDrawerOpen: false,
  isOnboardingOpen: false,
  activeModal: null,
  toasts: [],
  isSidebarCollapsed: false,

  openWalletDrawer: () => set({ isWalletDrawerOpen: true }),
  closeWalletDrawer: () => set({ isWalletDrawerOpen: false }),

  setOnboardingOpen: (open: boolean) => set({ isOnboardingOpen: open }),

  openModal: (id: string) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),

  addToast: (toast) => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { ...toast, id }],
    }));
    const duration = toast.duration ?? 5000;
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
}));
