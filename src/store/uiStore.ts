import { create } from 'zustand';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'whale';
  message: string;
  duration?: number;
  href?: string;
}

interface UIStore {
  isWalletDrawerOpen: boolean;
  isOnboardingOpen: boolean;
  activeModal: string | null;
  modalData?: any;
  toasts: Toast[];
  isSidebarCollapsed: boolean;
  isMobileMenuOpen: boolean;
  isLiveActivitySheetOpen: boolean;
  openWalletDrawer: () => void;
  closeWalletDrawer: () => void;
  setOnboardingOpen: (open: boolean) => void;
  openModal: (id: string, data?: any) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  toggleSidebar: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  setLiveActivitySheetOpen: (open: boolean) => void;
}

let toastCounter = 0;

export const useUIStore = create<UIStore>((set) => ({
  isWalletDrawerOpen: false,
  isOnboardingOpen: false,
  activeModal: null,
  modalData: null,
  toasts: [],
  isSidebarCollapsed: false,
  isMobileMenuOpen: false,
  isLiveActivitySheetOpen: false,

  openWalletDrawer: () => set({ isWalletDrawerOpen: true }),
  closeWalletDrawer: () => set({ isWalletDrawerOpen: false }),

  setOnboardingOpen: (open: boolean) => set({ isOnboardingOpen: open }),

  openModal: (id: string, data?: any) => set({ activeModal: id, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),

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

  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  
  setLiveActivitySheetOpen: (open) => set({ isLiveActivitySheetOpen: open }),
}));
