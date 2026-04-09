'use client';

import React, { useRef, useState, useCallback } from 'react';
import { useCreateTokenStore } from '@/hooks/useCreateToken';
import { uploadToIPFS } from '@/lib/pinata';
import { checkNameUniqueness, checkSymbolUniqueness } from '@/lib/api';
import { Info } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

/* ── Step 1 — Token Identity ── */

export function StepIdentity() {
  const { formData, updateFormData, errors, setError } = useCreateTokenStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [checkingName, setCheckingName] = useState(false);
  const [checkingSymbol, setCheckingSymbol] = useState(false);
  const nameTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const symbolTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleFile = useCallback(
    async (file: File) => {
      // Validate type
      const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!ALLOWED.includes(file.type)) {
        setError('image', 'Allowed: JPG, PNG, GIF, WebP');
        return;
      }
      // Validate size
      if (file.size > 5 * 1024 * 1024) {
        setError('image', 'Max file size is 5MB');
        return;
      }

      setError('image', null);

      // Create preview
      const previewUrl = URL.createObjectURL(file);
      updateFormData({ imageFile: file, imagePreviewUrl: previewUrl });

      // Upload to IPFS
      setIsUploadingImage(true);
      try {
        const ipfsUri = await uploadToIPFS(file);
        updateFormData({ imageIpfsUri: ipfsUri });
      } catch {
        // If IPFS upload fails (e.g. no Pinata key), keep the local preview
        // The deploy step will re-try or use the blob URL
        console.warn('IPFS upload failed, using local preview');
      } finally {
        setIsUploadingImage(false);
      }
    },
    [setError, updateFormData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleNameBlur = useCallback(() => {
    const name = formData.name.trim();
    if (!name || name.length < 2) return;
    if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
    nameTimeoutRef.current = setTimeout(async () => {
      setCheckingName(true);
      try {
        const available = await checkNameUniqueness(name);
        if (!available) setError('name', 'Name already taken');
        else setError('name', null);
      } catch {
        // API error, don't block the user
      } finally {
        setCheckingName(false);
      }
    }, 300);
  }, [formData.name, setError]);

  const handleSymbolBlur = useCallback(() => {
    const symbol = formData.symbol.trim();
    if (!symbol) return;
    if (symbolTimeoutRef.current) clearTimeout(symbolTimeoutRef.current);
    symbolTimeoutRef.current = setTimeout(async () => {
      setCheckingSymbol(true);
      try {
        const available = await checkSymbolUniqueness(symbol);
        if (!available) setError('symbol', 'Symbol already taken');
        else setError('symbol', null);
      } catch {
        // API error
      } finally {
        setCheckingSymbol(false);
      }
    }, 300);
  }, [formData.symbol, setError]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Image Upload */}
      <div>
        <label style={labelStyle}>
          Token Image <span style={{ color: 'var(--sell)' }}>*</span>
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            width: '100%',
            height: 200,
            border: `2px dashed ${isDragging ? 'var(--buy)' : errors.image ? 'var(--sell)' : 'var(--border-active)'}`,
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: isDragging ? 'var(--buy-dim)' : 'var(--bg-elevated)',
            transition: 'all var(--duration-base)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {formData.imagePreviewUrl ? (
            <>
              <img
                src={formData.imagePreviewUrl}
                alt="Token preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
              {isUploadingImage && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--overlay-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--buy)',
                    }}
                  >
                    Uploading to IPFS...
                  </span>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Drop image here or click to upload
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}
              >
                400×400px minimum · JPG, PNG, GIF, WebP · Max 5MB
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
        {errors.image && <div style={errorStyle}>{errors.image}</div>}
      </div>

      {/* Token Name */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={labelStyle}>
            Token Name <span style={{ color: 'var(--sell)' }}>*</span>
          </label>
          <span style={counterStyle}>{formData.name.length}/32</span>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="e.g. Pepe The Frog"
            maxLength={32}
            value={formData.name}
            onChange={(e) => {
              updateFormData({ name: e.target.value });
              if (errors.name) setError('name', null);
            }}
            onBlur={handleNameBlur}
            style={inputStyle}
          />
          {checkingName && (
            <span style={{ ...spinnerStyle, position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
              ⟳
            </span>
          )}
        </div>
        {errors.name && <div style={errorStyle}>{errors.name}</div>}
      </div>

      {/* Symbol */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={labelStyle}>
            Symbol <span style={{ color: 'var(--sell)' }}>*</span>
          </label>
          <span style={counterStyle}>{formData.symbol.length}/10</span>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="e.g. PEPE"
            maxLength={10}
            value={formData.symbol}
            onChange={(e) => {
              const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
              updateFormData({ symbol: val });
              if (errors.symbol) setError('symbol', null);
            }}
            onBlur={handleSymbolBlur}
            style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
          />
          {checkingSymbol && (
            <span style={{ ...spinnerStyle, position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
              ⟳
            </span>
          )}
        </div>
        {errors.symbol && <div style={errorStyle}>{errors.symbol}</div>}
      </div>

      {/* Description */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={labelStyle}>Description</label>
          <span style={counterStyle}>{formData.description.length}/280</span>
        </div>
        <textarea
          placeholder="What's your token about?"
          maxLength={280}
          value={formData.description}
          onChange={(e) => updateFormData({ description: e.target.value })}
          rows={3}
          style={{
            ...inputStyle,
            resize: 'vertical',
            minHeight: 80,
          }}
        />
      </div>

      {/* Total Supply */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <label style={labelStyle}>
            Total Supply <span style={{ color: 'var(--sell)' }}>*</span>
          </label>
          <Tooltip content="Maximum tokens that can ever be minted">
            <Info size={14} style={{ color: 'var(--text-muted)', cursor: 'help' }} />
          </Tooltip>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="number"
            placeholder="100,000"
            min={1000}
            max={1000000000}
            step={1000}
            value={formData.totalSupply || ''}
            onChange={(e) => {
              const val = Math.floor(Number(e.target.value));
              updateFormData({ totalSupply: val });
              if (errors.totalSupply) setError('totalSupply', null);
            }}
            style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
          />
          <span
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            tokens
          </span>
        </div>
        {errors.totalSupply && <div style={errorStyle}>{errors.totalSupply}</div>}
      </div>

      {/* Creator Allocation Slider */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <label style={labelStyle}>Creator Allocation</label>
          <Tooltip content="Percentage of supply minted to your wallet at launch">
            <Info size={14} style={{ color: 'var(--text-muted)', cursor: 'help' }} />
          </Tooltip>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={formData.creatorAllocation}
            onChange={(e) => updateFormData({ creatorAllocation: Number(e.target.value) })}
            style={{
              flex: 1,
              accentColor: 'var(--buy)',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              minWidth: 40,
              textAlign: 'right',
            }}
          >
            {formData.creatorAllocation}%
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: 'var(--space-1)',
            display: 'block',
          }}
        >
          {formData.totalSupply > 0
            ? `${Math.floor(formData.totalSupply * formData.creatorAllocation / 100).toLocaleString()} tokens minted to you`
            : ''}
        </span>
      </div>
    </div>
  );
}

/* ── Shared Styles ── */

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: 'var(--space-2)',
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-3)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-ui)',
  fontSize: '15px',
  color: 'var(--text-primary)',
  outline: 'none',
  transition: 'border-color var(--duration-fast)',
};

const errorStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '12px',
  color: 'var(--sell)',
  marginTop: 'var(--space-1)',
};

const counterStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  color: 'var(--text-muted)',
};

const spinnerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '14px',
  color: 'var(--text-muted)',
  animation: 'spin 1s linear infinite',
};
