'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useFeedStore } from '@/store/feedStore';
import { MOCK_TOKENS } from '@/lib/mockData';
import { formatNumber } from '@/lib/format';

const TRENDING_TAGS = ['trending', 'new', 'sigmoid', 'near-grad'];

export function TopBar() {
  const [searchValue, setSearchValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const { activeTags, toggleTag } = useFeedStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter tokens by search query
  const searchResults = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (q.length < 1) return [];
    return MOCK_TOKENS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.creatorHandle.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [searchValue]);

  const showDropdown = isFocused && searchValue.length > 0;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      id="top-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-3) var(--space-5)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-base)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        height: '56px',
        flexShrink: 0,
      }}
    >
      {/* Search */}
      <div
        ref={dropdownRef}
        style={{
          position: 'relative',
          flex: 1,
          maxWidth: '480px',
        }}
      >
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: 'var(--space-3)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          placeholder="Search tokens, creators..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          id="search-input"
          style={{
            width: '100%',
            height: '36px',
            paddingLeft: 'var(--space-7)',
            paddingRight: 'var(--space-3)',
            background: 'var(--bg-card)',
            border: `1px solid ${isFocused ? 'var(--border-active)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-ui)',
            fontSize: '14px',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'border-color var(--duration-fast)',
          }}
        />

        {/* Search dropdown */}
        {showDropdown && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 'var(--space-1)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-dropdown)',
              overflow: 'hidden',
              zIndex: 30,
            }}
          >
            {searchResults.length === 0 ? (
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  padding: 'var(--space-4)',
                }}
              >
                No results for &ldquo;{searchValue}&rdquo;
              </div>
            ) : (
              searchResults.map((token) => (
                <Link
                  key={token.mint}
                  href={`/token/${token.mint}`}
                  onClick={() => {
                    setSearchValue('');
                    setIsFocused(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    textDecoration: 'none',
                    borderBottom: '1px solid var(--border)',
                    transition: 'background var(--duration-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Token icon placeholder */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-display)',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      flexShrink: 0,
                    }}
                  >
                    {token.symbol.slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        ${token.symbol}
                      </span>
                      <Badge variant="curve">{token.curveType.toUpperCase()}</Badge>
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {token.name} · by @{token.creatorHandle}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color:
                        token.priceChange24h >= 0 ? 'var(--buy)' : 'var(--sell)',
                      flexShrink: 0,
                    }}
                  >
                    {token.priceChange24h >= 0 ? '+' : ''}
                    {token.priceChange24h.toFixed(1)}%
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* Trending tags */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          overflowX: 'auto',
          flexShrink: 0,
        }}
        className="hide-scrollbar"
      >
        {TRENDING_TAGS.map((tag) => {
          const isActive = activeTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                background: isActive ? 'var(--brand)' : 'var(--bg-elevated)',
                color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all var(--duration-fast)',
              }}
            >
              #{tag}
            </button>
          );
        })}
      </div>
    </header>
  );
}
