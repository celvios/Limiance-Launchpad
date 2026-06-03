'use client';

import React, { useEffect, useRef } from 'react';
import { useWallet } from '@/providers/BscWalletProvider';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useUIStore } from '@/store/uiStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { OnboardingModal } from './OnboardingModal';

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useWallet();
  const { needsOnboarding, profileLoading, checkProfile } = useOnboarding();
  const { isOnboardingOpen, setOnboardingOpen } = useUIStore();
  const { reset } = useOnboardingStore();
  const prevAuthRef = useRef(false);

  // When wallet authenticates, check if profile exists
  useEffect(() => {
    if (isAuthenticated && !prevAuthRef.current) {
      // Slight delay to let wallet drawer close first
      const timer = setTimeout(() => {
        checkProfile();
      }, 300);
      return () => clearTimeout(timer);
    }

    if (!isAuthenticated && prevAuthRef.current) {
      // Wallet disconnected/logged out — close onboarding if open
      setOnboardingOpen(false);
      reset();
    }

    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, checkProfile, setOnboardingOpen, reset]);

  // Open modal when we determine user needs onboarding
  useEffect(() => {
    if (needsOnboarding && !profileLoading) {
      setOnboardingOpen(true);
    }
  }, [needsOnboarding, profileLoading, setOnboardingOpen]);

  const handleComplete = () => {
    setOnboardingOpen(false);
    reset();
  };

  // Guests (no wallet) see the app normally
  // Wallet connected but still checking — app renders, modal fires after check
  return (
    <>
      {children}
      {isOnboardingOpen && <OnboardingModal onComplete={handleComplete} />}
    </>
  );
}
