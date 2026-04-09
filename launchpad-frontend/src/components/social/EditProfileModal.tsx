'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUpdateProfile } from '@/hooks/useProfile';
import { useUIStore } from '@/store/uiStore';

interface EditProfileModalProps {
  walletAddress: string;
  currentUsername: string | null;
  currentBio: string | null;
}

export function EditProfileModal({
  walletAddress,
  currentUsername,
  currentBio,
}: EditProfileModalProps) {
  const { activeModal, closeModal } = useUIStore();
  const isOpen = activeModal === 'edit-profile';

  const [username, setUsername] = useState(currentUsername ?? '');
  const [bio, setBio] = useState(currentBio ?? '');
  const updateMutation = useUpdateProfile(walletAddress);

  useEffect(() => {
    if (isOpen) {
      setUsername(currentUsername ?? '');
      setBio(currentBio ?? '');
    }
  }, [isOpen, currentUsername, currentBio]);

  if (!isOpen) return null;

  const handleSave = () => {
    updateMutation.mutate(
      { username: username.trim(), bio: bio.trim() },
      { onSuccess: () => closeModal() }
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeModal}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--overlay-hard)',
          zIndex: 50,
          animation: 'fadeIn 200ms var(--ease-default)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          maxWidth: 420,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-6)',
          zIndex: 51,
          boxShadow: 'var(--shadow-modal)',
          animation: 'slideUp 300ms var(--ease-default)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-5)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              color: 'var(--text-primary)',
              letterSpacing: '2px',
            }}
          >
            EDIT PROFILE
          </h2>
          <button
            onClick={closeModal}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 'var(--space-1)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Username */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 'var(--space-2)',
            }}
          >
            Username
          </label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value.slice(0, 20))}
            placeholder="Enter username"
          />
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: 'var(--space-1)',
              textAlign: 'right',
            }}
          >
            {username.length}/20
          </div>
        </div>

        {/* Bio */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 'var(--space-2)',
            }}
          >
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 160))}
            placeholder="Tell people about yourself"
            style={{
              width: '100%',
              minHeight: 80,
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-ui)',
              fontSize: '15px',
              color: 'var(--text-primary)',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color var(--duration-fast)',
            }}
          />
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: 'var(--space-1)',
              textAlign: 'right',
            }}
          >
            {bio.length}/160
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            justifyContent: 'flex-end',
          }}
        >
          <Button variant="ghost" size="md" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={updateMutation.isPending}
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      </div>
    </>
  );
}
