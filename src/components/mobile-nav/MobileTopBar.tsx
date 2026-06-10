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
        justifyContent: 'space-between',
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
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
        
        {/* Left Actions - Hamburger */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            position: 'absolute',
            left: 0,
            transition: 'opacity 200ms',
            opacity: isSearchExpanded ? 0 : 1,
            pointerEvents: isSearchExpanded ? 'none' : 'auto',
          }}
        >
          <button
            onClick={() => setMobileMenuOpen(true)}
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          </button>
        </div>



        {/* Search Input Section */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            transition: 'opacity 300ms var(--ease-default), transform 300ms var(--ease-default)',
            opacity: isSearchExpanded ? 1 : 0,
            transform: isSearchExpanded ? 'translateX(0)' : 'translateX(20px)',
            pointerEvents: isSearchExpanded ? 'auto' : 'none',
            zIndex: 2,
          }}
        >
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                padding: '0 var(--space-8) 0 var(--space-3)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => {
                setIsSearchExpanded(false);
                setSearchValue('');
              }}
              style={{
                position: 'absolute',
                right: '4px',
                width: '32px',
                height: '32px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Right Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            position: 'absolute',
            right: 0,
            transition: 'opacity 200ms',
            opacity: isSearchExpanded ? 0 : 1,
            pointerEvents: isSearchExpanded ? 'none' : 'auto',
          }}
        >
          <button
            onClick={() => setIsSearchExpanded(true)}
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
            }}
          >
            <Search size={20} />
          </button>

        </div>

      </div>
    </header>
  );
}
