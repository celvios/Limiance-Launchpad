'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Check, X as XIcon } from 'lucide-react';
import { AvatarUpload } from '../ui/AvatarUpload';
import { CoverUpload } from '../ui/CoverUpload';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useOnboarding } from '@/hooks/useOnboarding';
import type { UsernameStatus } from '@/hooks/useOnboarding';

interface StepIdentityProps {
  onBack: () => void;
  onNext: () => void;
  direction: 'forward' | 'back';
}

export function StepIdentity({ onBack, onNext, direction }: StepIdentityProps) {
  const {
    username,
    setUsername,
    profilePicUri,
    setProfilePicUri,
    coverUri,
    setCoverUri,
    profilePicUploading,
    setProfilePicUploading,
    coverUploading,
    setCoverUploading,
  } = useOnboardingStore();

  const {
    checkUsername,
    createProfile,
    uploadFile,
    creating,
    createError,
    diceBearUrl,
  } = useOnboarding();

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Check username on change
  useEffect(() => {
    checkUsername(username, setUsernameStatus);
  }, [username, checkUsername]);

  const isUsernameValid = usernameStatus === 'available';
  const isSubmitDisabled = !isUsernameValid || creating;

  /* ── Avatar handlers ── */
  const handleAvatarSelect = useCallback(
    async (file: File) => {
      setAvatarPreview(URL.createObjectURL(file));
      setProfilePicUploading(true);
      const uri = await uploadFile(file);
      setProfilePicUri(uri);
      setProfilePicUploading(false);
    },
    [uploadFile, setProfilePicUri, setProfilePicUploading]
  );

  const handleAvatarRemove = useCallback(() => {
    setAvatarPreview(null);
    setProfilePicUri(null);
  }, [setProfilePicUri]);

  /* ── Cover handlers ── */
  const handleCoverSelect = useCallback(
    async (file: File) => {
      setCoverPreview(URL.createObjectURL(file));
      setCoverUploading(true);
      const uri = await uploadFile(file);
      setCoverUri(uri);
      setCoverUploading(false);
    },
    [uploadFile, setCoverUri, setCoverUploading]
  );

  const handleCoverRemove = useCallback(() => {
    setCoverPreview(null);
    setCoverUri(null);
  }, [setCoverUri]);

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!isUsernameValid) return;

    // Wait for pending uploads
    if (profilePicUploading || coverUploading) return;

    const success = await createProfile({
      username: username.trim(),
      profilePicUri,
      coverUri,
    });

    if (success) {
      onNext();
    }
  };

  /* ── Validation message ── */
  const renderValidation = () => {
    switch (usernameStatus) {
      case 'idle':
        return null;
      case 'checking':
        return (
          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={12} style={{ animation: 'spin 600ms linear infinite' }} />
            Checking availability...
          </span>
        );
      case 'available':
        return (
          <span style={{ color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={12} />
            @{username} is available
          </span>
        );
      case 'taken':
        return (
          <span style={{ color: 'var(--sell)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <XIcon size={12} />
            @{username} is already taken
          </span>
        );
      case 'too_short':
        return (
          <span style={{ color: 'var(--sell)' }}>Must be at least 3 characters</span>
        );
      case 'too_long':
        return (
          <span style={{ color: 'var(--sell)' }}>Must be 20 characters or less</span>
        );
      case 'invalid_chars':
        return (
          <span style={{ color: 'var(--sell)' }}>Letters, numbers and underscores only</span>
        );
      default:
        return null;
    }
  };

  const animClass =
    direction === 'forward' ? 'step-content-enter' : 'step-content-enter-reverse';

  return (
    <div className={animClass} key="step-identity">
      {/* Header with back button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 28,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            transition: 'color 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            color: 'var(--text-primary)',
            letterSpacing: '2px',
          }}
        >
          SET UP YOUR PROFILE
        </h2>
      </div>

      {/* Avatar Upload */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 12,
          padding: '20px',
          marginBottom: 16,
        }}
      >
        <AvatarUpload
          preview={avatarPreview}
          uploading={profilePicUploading}
          onFileSelect={handleAvatarSelect}
          onRemove={handleAvatarRemove}
          diceBearUrl={diceBearUrl}
        />
      </div>

      {/* Cover Upload */}
      <div style={{ marginBottom: 24 }}>
        <CoverUpload
          preview={coverPreview}
          uploading={coverUploading}
          onFileSelect={handleCoverSelect}
          onRemove={handleCoverRemove}
        />
      </div>

      {/* Username Field */}
      <div style={{ marginBottom: 24 }}>
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: 8,
          }}
        >
          Username <span style={{ color: 'var(--sell)' }}>*</span>
        </label>

        {/* Input with @ prefix */}
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              fontFamily: 'var(--font-ui)',
              fontSize: '15px',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          >
            @
          </span>
          <input
            className={`glass-input ${
              usernameStatus === 'available'
                ? 'valid'
                : usernameStatus === 'taken' ||
                  usernameStatus === 'too_short' ||
                  usernameStatus === 'too_long' ||
                  usernameStatus === 'invalid_chars'
                ? 'error'
                : ''
            }`}
            style={{ paddingLeft: 32 }}
            value={username}
            onChange={(e) =>
              setUsername(
                e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20)
              )
            }
            placeholder="handle"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        {/* Validation message */}
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '12px',
            marginTop: 8,
            minHeight: 18,
          }}
        >
          {renderValidation()}
        </div>
      </div>

      {/* Submit button */}
      <button
        className="glass-button-primary"
        disabled={isSubmitDisabled}
        onClick={handleSubmit}
      >
        {creating ? (
          <>
            <Loader2 size={16} style={{ animation: 'spin 600ms linear infinite' }} />
            Creating...
          </>
        ) : (
          <>
            Create Profile
            <ArrowRight size={16} />
          </>
        )}
      </button>

      {/* Error message */}
      {createError && (
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            color: 'var(--sell)',
            textAlign: 'center',
            marginTop: 12,
          }}
        >
          {createError}
        </div>
      )}

      {/* Upload pending hint */}
      {(profilePicUploading || coverUploading) && (
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          Uploading images...
        </div>
      )}
    </div>
  );
}
