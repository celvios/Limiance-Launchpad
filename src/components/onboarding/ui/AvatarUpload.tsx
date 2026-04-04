'use client';

import React, { useState, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Camera, X, Loader2 } from 'lucide-react';

interface AvatarUploadProps {
  preview: string | null;
  uploading: boolean;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  diceBearUrl: string;
}

/* ── Canvas crop helper ── */
async function getCroppedImage(
  imageSrc: string,
  pixelCrop: Area
): Promise<File> {
  const image = new Image();
  image.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error('Canvas toBlob failed');
      resolve(new File([blob], 'avatar.png', { type: 'image/png' }));
    }, 'image/png');
  });
}

export function AvatarUpload({
  preview,
  uploading,
  onFileSelect,
  onRemove,
  diceBearUrl,
}: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  // Crop state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be reselected
    e.target.value = '';
  };

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    try {
      const croppedFile = await getCroppedImage(cropSrc, croppedAreaPixels);
      onFileSelect(croppedFile);
    } catch {
      // Fallback: use original file
    }
    setCropSrc(null);
  };

  const handleCropCancel = () => {
    setCropSrc(null);
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Circle zone */}
        <div
          onClick={() => fileRef.current?.click()}
          className="upload-zone"
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt="Avatar preview"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '50%',
              }}
            />
          ) : (
            <Camera size={24} style={{ color: 'var(--text-muted)' }} />
          )}

          {/* Upload progress ring */}
          {uploading && (
            <div
              style={{
                position: 'absolute',
                inset: -2,
                borderRadius: '50%',
                border: '2px solid transparent',
                borderTopColor: 'var(--buy)',
                animation: 'uploadSpin 800ms linear infinite',
              }}
            />
          )}

          {/* Remove button */}
          {preview && !uploading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 22,
                height: 22,
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
        </div>

        {/* Label */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}
          >
            Profile Picture
          </div>
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            Optional · JPG PNG GIF
          </div>
        </div>

        {/* DiceBear hint */}
        {!preview && (
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <img
              src={diceBearUrl}
              alt="Generated avatar"
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                opacity: 0.5,
              }}
            />
            An avatar will be generated for you
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* ── Crop Modal ── */}
      {cropSrc && (
        <div className="crop-overlay">
          <div
            style={{
              width: 340,
              height: 340,
              position: 'relative',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 12,
              marginTop: 20,
            }}
          >
            <button
              className="glass-button-outlined"
              style={{ width: 120, padding: '10px 16px' }}
              onClick={handleCropCancel}
            >
              Cancel
            </button>
            <button
              className="glass-button-primary"
              style={{ width: 120, padding: '10px 16px' }}
              onClick={handleCropConfirm}
            >
              Crop
            </button>
          </div>
        </div>
      )}
    </>
  );
}
