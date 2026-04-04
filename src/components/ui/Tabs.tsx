'use client';

import React from 'react';

interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className = '' }: TabsProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        gap: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              fontFamily: 'var(--font-ui)',
              fontSize: '14px',
              fontWeight: 500,
              color: isActive ? 'var(--brand)' : 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--brand)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 150ms',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-muted)';
              }
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
