'use client';

import React from 'react';
import { useCreateTokenStore } from '@/hooks/useCreateToken';
import { StepIdentity } from '@/components/create/StepIdentity';
import { StepCurve } from '@/components/create/StepCurve';
import { StepReview } from '@/components/create/StepReview';
import { DeploySuccessModal } from '@/components/create/DeploySuccessModal';
import { Button } from '@/components/ui/Button';
import { BrandHeadline } from '@/components/ui/BrandHeadline';
import type { CreateTokenStep } from '@/lib/types';

/* ── Create Token Wizard ── */

const STEPS: { label: string; num: number }[] = [
  { label: 'Identity', num: 1 },
  { label: 'Curve', num: 2 },
  { label: 'Review', num: 3 },
];

export default function CreatePage() {
  const {
    currentStep,
    nextStep,
    prevStep,
    validateStep1,
    validateStep2,
    deployState,
  } = useCreateTokenStore();

  const handleNext = () => {
    if (currentStep === 0) {
      if (!validateStep1()) return;
    } else if (currentStep === 1) {
      if (!validateStep2()) return;
    }
    nextStep();
  };

  const isDeploying =
    deployState === 'uploading' ||
    deployState === 'preparing' ||
    deployState === 'confirming';

  return (
    <div
      style={{
        maxWidth: 600,
        margin: '0 auto',
        padding: 'var(--space-5)',
      }}
    >
      {/* Header */}
      <BrandHeadline
        before="Launch something"
        highlight="real."
        as="h1"
        size={40}
        style={{ marginBottom: 'var(--space-2)' }}
      />
      <p
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '14px',
          color: 'var(--text-muted)',
          marginBottom: 'var(--space-6)',
        }}
      >
        Create a token with a custom bonding curve in 3 steps.
      </p>

      {/* Step Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          marginBottom: 'var(--space-7)',
        }}
      >
        {STEPS.map((step, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          const stepVal = i as CreateTokenStep;

          return (
            <React.Fragment key={i}>
              {/* Connector line (before each step except first) */}
              {i > 0 && (
                <div
                  style={{
                    width: 60,
                    height: 2,
                    background: isCompleted
                      ? 'var(--brand)'
                      : 'var(--border)',
                    transition: 'background var(--duration-base)',
                  }}
                />
              )}

              {/* Step circle + label */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    fontWeight: 600,
                    transition: 'all var(--duration-base)',
                    ...(isCompleted
                      ? {
                          background: 'var(--brand)',
                          color: '#FFFFFF',
                          border: '2px solid var(--brand)',
                        }
                      : isCurrent
                      ? {
                          background: 'var(--brand)',
                          color: '#FFFFFF',
                          border: '2px solid var(--brand)',
                        }
                      : {
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          border: '2px solid var(--border)',
                        }),
                  }}
                >
                  {isCompleted ? '✓' : step.num}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '11px',
                    color: isCurrent
                      ? 'var(--brand)'
                      : isCompleted
                      ? 'var(--brand)'
                      : 'var(--text-muted)',
                    fontWeight: isCurrent ? 600 : 400,
                    transition: 'color var(--duration-base)',
                  }}
                >
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-6)',
          marginBottom: 'var(--space-5)',
          animation: 'fadeIn 200ms var(--ease-default)',
        }}
        key={currentStep} // re-mount to trigger animation
      >
        {currentStep === 0 && <StepIdentity />}
        {currentStep === 1 && <StepCurve />}
        {currentStep === 2 && <StepReview />}
      </div>

      {/* Navigation */}
      {currentStep < 2 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
          }}
        >
          {currentStep > 0 ? (
            <Button
              variant="ghost"
              size="md"
              onClick={prevStep}
            >
              ← Back
            </Button>
          ) : (
            <div />
          )}
          <Button
            variant="primary"
            size="md"
            onClick={handleNext}
          >
            Next →
          </Button>
        </div>
      )}

      {/* Back button on review step (deploy is inside StepReview) */}
      {currentStep === 2 && !isDeploying && deployState !== 'success' && (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Button variant="ghost" size="md" onClick={prevStep}>
            ← Back
          </Button>
        </div>
      )}

      {/* Success Modal */}
      <DeploySuccessModal />
    </div>
  );
}
