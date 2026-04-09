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
    whale: 'var(--brand)',
  };

  if (toast.type === 'whale') {
    return (
      <div
        onClick={() => {
           if (toast.href) {
             window.location.href = toast.href;
           }
        }}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--bg-elevated)',
          borderLeft: `3px solid ${borderColors.whale}`,
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          animation: 'slideDownFromTop 400ms var(--ease-spring)',
          minWidth: '280px',
          maxWidth: '400px',
          cursor: toast.href ? 'pointer' : 'default',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            🐋 Whale Alert
          </span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {toast.message}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeToast(toast.id);
          }}
          aria-label="Dismiss toast"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            flexShrink: 0,
            marginTop: '-2px',
            marginRight: '-4px',
          }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

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

  const whaleToasts = toasts.filter(t => t.type === 'whale');
  const regularToasts = toasts.filter(t => t.type !== 'whale');

  return (
    <>
      {/* Whale Toasts (Top) */}
      {whaleToasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 'env(safe-area-inset-top, 16px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            width: 'calc(100% - 32px)',
            maxWidth: '400px',
            marginTop: '16px'
          }}
        >
          {whaleToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} />
          ))}
        </div>
      )}

      {/* Regular Toasts (Bottom) */}
      {regularToasts.length > 0 && (
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
          {regularToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} />
          ))}
        </div>
      )}
    </>
  );
}
