'use client';

import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { submitReport } from '@/lib/api';
import { useWallet } from '@/providers/BscWalletProvider';
import { useUIStore } from '@/store/uiStore';
import type { ReportReason, ReportTargetType } from '@/lib/types';

const REASONS: Record<ReportTargetType, Array<{ value: ReportReason; label: string }>> = {
  comment: [
    { value: 'spam', label: 'Spam' }, { value: 'scam', label: 'Scam or promotion' },
    { value: 'harassment', label: 'Harassment' }, { value: 'hate_or_abuse', label: 'Hate or abuse' },
    { value: 'fraud_or_impersonation', label: 'Fraud or impersonation' }, { value: 'offensive_content', label: 'Offensive content' }, { value: 'other', label: 'Other' },
  ],
  token: [
    { value: 'scam', label: 'Scam or malicious token' }, { value: 'fraud_or_impersonation', label: 'Fraud or impersonation' },
    { value: 'market_manipulation', label: 'Market manipulation' }, { value: 'inappropriate_content', label: 'Inappropriate content' },
    { value: 'duplicate', label: 'Duplicate token' }, { value: 'other', label: 'Other' },
  ],
  profile: [
    { value: 'spam', label: 'Spam' }, { value: 'scam', label: 'Scam' }, { value: 'harassment', label: 'Harassment' },
    { value: 'hate_or_abuse', label: 'Hate or abuse' }, { value: 'fraud_or_impersonation', label: 'Fraud or impersonation' },
    { value: 'inappropriate_content', label: 'Inappropriate content' }, { value: 'other', label: 'Other' },
  ],
};

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
}

export function ReportModal({ open, onClose, targetType, targetId, targetLabel }: ReportModalProps) {
  const { address, token } = useWallet();
  const { addToast } = useUIStore();
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!address) {
      addToast({ type: 'error', message: 'Sign in to report this item.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await submitReport({ reporterWallet: address, targetType, targetId, reason, details: details.trim() || undefined, token });
      addToast({ type: 'success', message: 'Report submitted. Thank you for helping keep Limiance safe.' });
      setDetails('');
      onClose();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'Unable to submit report' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={`Report ${targetLabel}`}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <label style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', fontSize: 14 }}>
          Reason
          <select value={reason} onChange={(event) => setReason(event.target.value as ReportReason)} style={{ display: 'block', width: '100%', marginTop: 8, padding: 12, background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            {REASONS[targetType].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', fontSize: 14 }}>
          Additional details (optional)
          <textarea value={details} onChange={(event) => setDetails(event.target.value.slice(0, 500))} rows={4} placeholder="Tell us what is wrong..." style={{ display: 'block', width: '100%', marginTop: 8, padding: 12, resize: 'vertical', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-ui)' }} />
        </label>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>You can report an item once. Reports are reviewed by the Limiance team.</p>
        <button type="submit" disabled={isSubmitting} style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 12, border: 0, borderRadius: 'var(--radius-sm)', background: isSubmitting ? 'var(--bg-elevated)' : 'var(--brand)', color: '#fff', cursor: isSubmitting ? 'wait' : 'pointer', fontWeight: 600 }}>
          <Flag size={15} /> {isSubmitting ? 'Submitting...' : 'Submit report'}
        </button>
      </form>
    </Modal>
  );
}
