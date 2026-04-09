import { create } from 'zustand';

type OnboardingStep = 1 | 2 | 3;

interface OnboardingStore {
  step: OnboardingStep;
  username: string;
  profilePicUri: string | null;
  coverUri: string | null;
  profilePicUploading: boolean;
  coverUploading: boolean;
  setStep: (step: OnboardingStep) => void;
  setUsername: (username: string) => void;
  setProfilePicUri: (uri: string | null) => void;
  setCoverUri: (uri: string | null) => void;
  setProfilePicUploading: (uploading: boolean) => void;
  setCoverUploading: (uploading: boolean) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  step: 1 as OnboardingStep,
  username: '',
  profilePicUri: null as string | null,
  coverUri: null as string | null,
  profilePicUploading: false,
  coverUploading: false,
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  ...INITIAL_STATE,

  setStep: (step) => set({ step }),
  setUsername: (username) => set({ username }),
  setProfilePicUri: (uri) => set({ profilePicUri: uri }),
  setCoverUri: (uri) => set({ coverUri: uri }),
  setProfilePicUploading: (uploading) => set({ profilePicUploading: uploading }),
  setCoverUploading: (uploading) => set({ coverUploading: uploading }),
  reset: () => set(INITIAL_STATE),
}));
