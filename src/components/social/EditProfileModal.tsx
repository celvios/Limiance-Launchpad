'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUpdateProfile } from '@/hooks/useProfile';
import { useUIStore } from '@/store/uiStore';
import { uploadToIPFS } from '@/lib/pinata';

interface EditProfileModalProps {
  walletAddress: string;
  currentUsername: string | null;
  currentBio: string | null;
  currentProfilePicUri?: string | null;
}

/* Convert ipfs:// URI → HTTP gateway URL for display */
function resolveIpfs(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.startsWith('ipfs://')) {
    const cid = uri.replace('ipfs://', '');
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  return uri;
}

export function EditProfileModal({
  walletAddress,
  currentUsername,
  currentBio,
  currentProfilePicUri,
}: EditProfileModalProps) {
  const { activeModal, closeModal } = useUIStore();
  const isOpen = activeModal === 'edit-profile';

  const [username, setUsername] = useState(currentUsername ?? '');
  const [bio, setBio] = useState(currentBio ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateMutation = useUpdateProfile(walletAddress);

  /* Reset form when modal opens */
  useEffect(() => {
    if (isOpen) {
      setUsername(currentUsername ?? '');
      setBio(currentBio ?? '');
      setAvatarPreview(null);
      setAvatarFile(null);
    }
  }, [isOpen, currentUsername, currentBio]);

  const handleAvatarFile = useCallback((file: File) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED.includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAvatarFile(file);
  };

  const handleSave = async () => {
    let profilePicUri: string | undefined;

    if (avatarFile) {
      setIsUploadingAvatar(true);
      try {
        profilePicUri = await uploadToIPFS(avatarFile);
      } catch {
        /* Upload failed — save without changing avatar */
      } finally {
        setIsUploadingAvatar(false);
      }
    }

    updateMutation.mutate(
      { username: username.trim(), bio: bio.trim(), profilePicUri },
      { onSuccess: () => closeModal() }
    );
  };

  if (!isOpen) return null;

  const displayedAvatar = avatarPreview ?? resolveIpfs(currentProfilePicUri);
  const initials = (currentUsername ?? walletAddress.slice(0, 2)).slice(0, 2).toUpperCase();
  const isBusy = isUploadingAvatar || updateMutation.isPending;

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
          maxWidth: 440,
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

        {/* Avatar Upload */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 'var(--space-5)',
          }}
        >
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* Circle */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                overflow: 'hidden',
                background: displayedAvatar ? 'transparent' : 'var(--brand)',
                border: '3px solid var(--border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'border-color var(--duration-base)',
              }}
            >
              {displayedAvatar ? (
                <img
                  src={displayedAvatar}
                  alt="Profile"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '32px',
                    color: '#fff',
                    letterSpacing: '2px',
                  }}
                >
                  {initials}
                </span>
              )}

              {/* Hover overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity var(--duration-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
              >
                <Camera size={24} color="#fff" />
              </div>
            </div>

            {/* Upload spinner badge */}
            {isUploadingAvatar && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--bg-card)',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: '#fff',
                    animation: 'spin 1s linear infinite',
                  }}
                >
                  ⟳
                </span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: '-12px',
            marginBottom: 'var(--space-5)',
          }}
        >
          Click avatar to change • JPG, PNG, GIF, WebP · Max 5MB
        </div>

        {/* Username */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label style={labelStyle}>Username</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value.slice(0, 20))}
            placeholder="Enter username"
          />
          <div style={counterStyle}>{username.length}/20</div>
        </div>

        {/* Bio */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <label style={labelStyle}>Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 160))}
            placeholder="Tell people about yourself"
            style={{
              width: '100%',
              minHeight: 80,
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--bg-elevated)',
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
          <div style={counterStyle}>{bio.length}/160</div>
        </div>

        {/* Error */}
        {updateMutation.isError && (
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              color: 'var(--sell)',
              marginBottom: 'var(--space-3)',
            }}
          >
            {updateMutation.error instanceof Error
              ? updateMutation.error.message
              : 'Save failed. Try again.'}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="md" onClick={closeModal} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={isBusy}
            onClick={handleSave}
          >
            {isUploadingAvatar ? 'Uploading...' : 'Save'}
          </Button>
        </div>
      </div>
    </>
  );
}

/* ── Shared Styles ── */
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-ui)',
  fontSize: '12px',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 'var(--space-2)',
};

const counterStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  color: 'var(--text-muted)',
  marginTop: 'var(--space-1)',
  textAlign: 'right',
};
