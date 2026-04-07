'use client';

import React from 'react';
import Link from 'next/link';
import { LimianceLogo } from '@/components/ui/LimianceLogo';
import { StarGlyph } from '@/components/ui/StarGlyph';

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Feed', href: '/' },
      { label: 'Explore', href: '/explore' },
      { label: 'Create Token', href: '/create' },
      { label: 'All Tokens', href: '/explore' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'How It Works', href: '#' },
      { label: 'Fees', href: '#' },
      { label: 'Documentation', href: '#' },
      { label: 'API', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Announcements', href: '#' },
      { label: 'News', href: '#' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Support Center', href: '#' },
      { label: 'User Feedback', href: '#' },
      { label: 'Authenticity Check', href: '#' },
    ],
  },
];

const SOCIAL_LINKS = [
  { label: 'Twitter', icon: '𝕏', href: '#' },
  { label: 'Discord', icon: '💬', href: '#' },
  { label: 'Telegram', icon: '✈️', href: '#' },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      id="site-footer"
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-card)',
        padding: 'var(--space-8) var(--space-5) var(--space-5)',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        {/* Top section: Logo + Columns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr repeat(4, auto)',
            gap: 'var(--space-7)',
            marginBottom: 'var(--space-7)',
          }}
          className="footer-grid"
        >
          {/* Brand column */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 'var(--space-4)',
              }}
            >
              <LimianceLogo size={24} />
            </div>
            <p
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '13px',
                color: 'var(--text-muted)',
                lineHeight: 1.6,
                maxWidth: 220,
                marginBottom: 'var(--space-4)',
              }}
            >
              The most trusted token launchpad on Solana. Bonding curves, fair launches, automatic Raydium graduation.
            </p>
            {/* Social icons */}
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textDecoration: 'none',
                    fontSize: '14px',
                    transition: 'all var(--duration-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--brand-border)';
                    e.currentTarget.style.background = 'var(--brand-dim)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                  }}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h4
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-4)',
                  letterSpacing: '0.3px',
                }}
              >
                {col.title}
              </h4>
              <ul
                style={{
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                        textDecoration: 'none',
                        transition: 'color var(--duration-fast)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider with star glyph */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <StarGlyph size={12} opacity={0.15} />
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            © {year} Limiance. All rights reserved.
          </span>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-4)',
            }}
          >
            <a
              href="#"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                color: 'var(--text-muted)',
                textDecoration: 'none',
                transition: 'color var(--duration-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              Terms of Service
            </a>
            <a
              href="#"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                color: 'var(--text-muted)',
                textDecoration: 'none',
                transition: 'color var(--duration-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
