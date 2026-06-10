'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import { MenuHeader } from './MenuHeader';
import { MenuNavLinks } from './MenuNavLinks';
import { MenuWalletCard } from './MenuWalletCard';
import { useWallet } from '@/providers/BscWalletProvider';

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
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.38 }}
            drag="x"
            dragConstraints={{ left: -100, right: 0 }}
            dragElastic={{ left: 0.6, right: 0 }}
            onDragEnd={(e, info) => {
              if (info.offset.x < -80) {
                setMobileMenuOpen(false);
              }
            }}
            style={{
              position: 'fixed',
              top: 0,
              bottom: 0,
              left: 0,
              width: '85vw',
              maxWidth: '320px',
              background: 'var(--bg-card)',
              zIndex: 61,
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            className="menu-drawer"
          >

            {/* Scrollable Content Workspace */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
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
