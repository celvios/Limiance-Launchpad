'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import { MenuHeader } from './MenuHeader';
import { MenuNavLinks } from './MenuNavLinks';
import { MenuWalletCard } from './MenuWalletCard';
import { useWallet } from '@solana/wallet-adapter-react';

export function MenuDrawer() {
  const { isMobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const { connected } = useWallet();

  // Prevent background scrolling when open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  return (
    <AnimatePresence>
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 60,
            }}
          />

          {/* Drawer Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(e, info) => {
              if (info.offset.y > 80) {
                setMobileMenuOpen(false);
              }
            }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: '85dvh',
              background: 'var(--bg-card)',
              borderRadius: '20px 20px 0 0',
              zIndex: 61,
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: 'env(safe-area-inset-bottom)',
              // The padding for the bottom nav bar is slightly larger to ensure content doesn't get hidden behind it
              // Actually, bottom nav height is 64px, so we just add padding to the bottom of the drawer content.
            }}
            className="menu-drawer"
          >
            {/* Drag Handle */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                padding: '12px 0 8px 0',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '4px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--border-active)',
                }}
              />
            </div>

            {/* Scrollable Content Workspace */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                paddingBottom: '64px', // Space for when bottom nav is visible (though drawer covers it)
              }}
              className="hide-scrollbar"
            >
              <MenuHeader />
              
              <div style={{ padding: '0 var(--space-4) var(--space-4) var(--space-4)' }}>
                {connected && (
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <MenuWalletCard />
                  </div>
                )}
                <MenuNavLinks />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
