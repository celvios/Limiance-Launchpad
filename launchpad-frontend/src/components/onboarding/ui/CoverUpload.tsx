'use client';

import React, { useRef } from 'react';
import { ImageIcon, X } from 'lucide-react';

interface CoverUploadProps {
  preview: string | null;
  uploading: boolean;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
}

export function CoverUpload({
  preview,
  uploading,
  onFileSelect,
  onRemove,
}: CoverUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onFileSelect(file);
    e.target.value = '';
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => fileRef.current?.click()}
        className="upload-zone"
        style={{
          width: '100%',
          height: 90,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Cover preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ImageIcon size={20} style={{ color: 'var(--text-muted)' }} />
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}
            >
              Cover Image (optional)
            </div>
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                opacity: 0.6,
              }}
            >
              Click to upload · 1200×400px
            </div>
          </div>
        )}

        {/* Upload progress bar */}
        {uploading && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: '60%',
                background: 'var(--buy)',
                borderRadius: 2,
                animation: 'shimmer 1.5s infinite',
                backgroundSize: '200% 100%',
                backgroundImage:
                  'linear-gradient(90deg, var(--buy) 0%, rgba(0, 255, 102, 0.3) 50%, var(--buy) 100%)',
              }}
            />
          </div>
        )}
      </div>

      {/* Remove button */}
      {preview && !uploading && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'rgba(0, 0, 0, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <X size={12} />
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
