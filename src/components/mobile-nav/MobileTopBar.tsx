'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

export function MobileTopBar() {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { setMobileMenuOpen } = useUIStore();

  // Focus input when search expands
  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '52px',
        padding: '0 var(--space-4)',
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        flexShrink: 0,
      }}
    >
      {!isSearchExpanded ? (
        /* Normal mode: 3-column grid guarantees true centering */
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          width: '100%',
        }}>
          {/* Column 1 (left): Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" x2="20" y1="6" y2="6"/>
              <line x1="4" x2="20" y1="12" y2="12"/>
              <line x1="4" x2="20" y1="18" y2="18"/>
            </svg>
          </button>

          {/* Column 2 (center): Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Limiance"
              style={{ height: '26px', objectFit: 'contain', mixBlendMode: 'lighten' }}
            />
          </div>

          {/* Column 3 (right): Search — aligned to the right edge */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setIsSearchExpanded(true)}
              style={{
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <Search size={20} />
            </button>
          </div>
        </div>
      ) : (
        /* Expanded Search Mode */
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tokens, creators..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-active)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                padding: '0 36px 0 32px',
                outline: 'none',
              }}
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue('')}
                style={{
                  position: 'absolute',
                  right: '4px',
                  width: '28px',
                  height: '28px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setIsSearchExpanded(false);
              setSearchValue('');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--brand)',
              fontFamily: 'var(--font-ui)',
              fontSize: '14px',
              fontWeight: 600,
              padding: '0 4px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </header>
  );
}
