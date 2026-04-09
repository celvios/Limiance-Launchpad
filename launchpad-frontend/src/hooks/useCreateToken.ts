/* ── Create Token Wizard State ──
 * Zustand store for the 3-step token creation wizard.
 * Manages form data, validation, step navigation, and deploy state.
 */

import { create } from 'zustand';
import type { CreateTokenFormData, CreateTokenStep, CreateTokenValidation, CurveType, CurveParams } from '@/lib/types';

const DEFAULT_CURVE_PARAMS: Record<CurveType, CurveParams> = {
  linear: { type: 'linear', a: 0.0001, b: 0.000005 },
  exponential: { type: 'exponential', a: 0.00001, r: 0.0008 },
  sigmoid: { type: 'sigmoid', maxPrice: 0.1, k: 0.002, s0: 5000 },
};

interface CreateTokenStore {
  // Step
  currentStep: CreateTokenStep;
  setStep: (step: CreateTokenStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Form data
  formData: CreateTokenFormData;
  updateFormData: (partial: Partial<CreateTokenFormData>) => void;

  // Curve helpers
  setCurveType: (type: CurveType) => void;
  updateCurveParam: (key: string, value: number) => void;

  // Validation
  errors: CreateTokenValidation;
  setError: (field: keyof CreateTokenValidation, message: string | null) => void;
  clearErrors: () => void;
  validateStep1: () => boolean;
  validateStep2: () => boolean;

  // Deploy state
  deployState: 'idle' | 'uploading' | 'preparing' | 'confirming' | 'success' | 'error';
  deployMint: string | null;
  deployTxSig: string | null;
  setDeployState: (state: CreateTokenStore['deployState']) => void;
  setDeployResult: (mint: string, txSig: string) => void;

  // Reset
  reset: () => void;
}

const INITIAL_FORM_DATA: CreateTokenFormData = {
  imageFile: null,
  imagePreviewUrl: '',
  imageIpfsUri: '',
  name: '',
  symbol: '',
  description: '',
  totalSupply: 100000,
  creatorAllocation: 0,
  curveType: 'linear',
  curveParams: { ...DEFAULT_CURVE_PARAMS.linear },
  graduationThreshold: 80,
};

const INITIAL_ERRORS: CreateTokenValidation = {
  name: null,
  symbol: null,
  image: null,
  totalSupply: null,
  description: null,
};

export const useCreateTokenStore = create<CreateTokenStore>((set, get) => ({
  currentStep: 0,
  setStep: (step) => set({ currentStep: step }),
  nextStep: () => set((s) => ({ currentStep: Math.min(2, s.currentStep + 1) as CreateTokenStep })),
  prevStep: () => set((s) => ({ currentStep: Math.max(0, s.currentStep - 1) as CreateTokenStep })),

  formData: { ...INITIAL_FORM_DATA },
  updateFormData: (partial) =>
    set((s) => ({ formData: { ...s.formData, ...partial } })),

  setCurveType: (type) =>
    set((s) => ({
      formData: {
        ...s.formData,
        curveType: type,
        curveParams: { ...DEFAULT_CURVE_PARAMS[type] },
      },
    })),

  updateCurveParam: (key, value) =>
    set((s) => ({
      formData: {
        ...s.formData,
        curveParams: { ...s.formData.curveParams, [key]: value },
      },
    })),

  errors: { ...INITIAL_ERRORS },
  setError: (field, message) =>
    set((s) => ({ errors: { ...s.errors, [field]: message } })),
  clearErrors: () => set({ errors: { ...INITIAL_ERRORS } }),

  validateStep1: () => {
    const { formData } = get();
    const errors: CreateTokenValidation = { ...INITIAL_ERRORS };
    let valid = true;

    if (!formData.imageFile && !formData.imagePreviewUrl) {
      errors.image = 'Token image is required';
      valid = false;
    }
    if (!formData.name.trim()) {
      errors.name = 'Token name is required';
      valid = false;
    } else if (formData.name.length > 32) {
      errors.name = 'Max 32 characters';
      valid = false;
    }
    if (!formData.symbol.trim()) {
      errors.symbol = 'Symbol is required';
      valid = false;
    } else if (formData.symbol.length > 10) {
      errors.symbol = 'Max 10 characters';
      valid = false;
    } else if (!/^[A-Z0-9]+$/.test(formData.symbol)) {
      errors.symbol = 'Alphanumeric only';
      valid = false;
    }
    if (formData.totalSupply < 1000) {
      errors.totalSupply = 'Minimum 1,000 tokens';
      valid = false;
    } else if (formData.totalSupply > 1000000000) {
      errors.totalSupply = 'Maximum 1,000,000,000 tokens';
      valid = false;
    }

    set({ errors });
    return valid;
  },

  validateStep2: () => {
    // Curve params have defaults, always valid
    return true;
  },

  deployState: 'idle',
  deployMint: null,
  deployTxSig: null,
  setDeployState: (state) => set({ deployState: state }),
  setDeployResult: (mint, txSig) =>
    set({ deployMint: mint, deployTxSig: txSig, deployState: 'success' }),

  reset: () =>
    set({
      currentStep: 0,
      formData: { ...INITIAL_FORM_DATA },
      errors: { ...INITIAL_ERRORS },
      deployState: 'idle',
      deployMint: null,
      deployTxSig: null,
    }),
}));
