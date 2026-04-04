'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useUIStore, type Toast as ToastType } from '@/store/uiStore';

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useUIStore((s) => s.removeToast);

  const borderColors: Record<ToastType['type'], string> = {
    success: 'var(--buy)',
    error: 'var(--sell)',
    info: 'var(--border-active)',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${borderColors[toast.type]}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-dropdown)',
        animation: 'toastIn 300ms var(--ease-default)',
        minWidth: '280px',
        maxWidth: '400px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '14px',
          color: 'var(--text-primary)',
          flex: 1,
        }}
      >
        {toast.message}
      </span>
      <button
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss toast"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'var(--space-5)',
        right: 'var(--space-5)',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 'var(--space-2)',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
