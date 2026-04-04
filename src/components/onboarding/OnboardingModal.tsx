'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { GlassCard } from './ui/GlassCard';
import { StepWelcome } from './steps/StepWelcome';
import { StepIdentity } from './steps/StepIdentity';
import { StepDone } from './steps/StepDone';
import { StarGlyph } from '@/components/ui/StarGlyph';
import { useOnboardingStore } from '@/store/onboardingStore';

function StepDots({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="step-dots">
      {[1, 2, 3].map((i) => {
        let className = 'step-dot';
        if (i === current) className += ' active';
        else if (i < current) className += ' complete';
        return <div key={i} className={className} />;
      })}
    </div>
  );
}

/* Decorative star positions — scattered asymmetrically behind the glass card */
const STAR_POSITIONS = [
  { top: '12%', left: '8%', size: 24, opacity: 0.08, delay: '0s' },
  { top: '18%', right: '12%', size: 18, opacity: 0.06, delay: '1.5s' },
  { top: '45%', left: '5%', size: 14, opacity: 0.10, delay: '0.8s' },
  { bottom: '22%', right: '8%', size: 20, opacity: 0.07, delay: '2.2s' },
  { bottom: '35%', left: '15%', size: 12, opacity: 0.09, delay: '1s' },
  { top: '70%', right: '18%', size: 16, opacity: 0.06, delay: '3s' },
];

interface OnboardingModalProps {
  onComplete: () => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { step, setStep, reset } = useOnboardingStore();
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const goForward = useCallback(
    (nextStep: 1 | 2 | 3) => {
      setDirection('forward');
      setStep(nextStep);
    },
    [setStep]
  );

  const goBack = useCallback(
    (prevStep: 1 | 2 | 3) => {
      setDirection('back');
      setStep(prevStep);
    },
    [setStep]
  );

  const handleClose = useCallback(() => {
    reset();
    onComplete();
  }, [reset, onComplete]);

  const stepContent = useMemo(() => {
    switch (step) {
      case 1:
        return <StepWelcome onNext={() => goForward(2)} />;
      case 2:
        return (
          <StepIdentity
            onBack={() => goBack(1)}
            onNext={() => goForward(3)}
            direction={direction}
          />
        );
      case 3:
        return <StepDone onClose={handleClose} direction={direction} />;
      default:
        return null;
    }
  }, [step, direction, goForward, goBack, handleClose]);

  return (
    <div className="onboarding-backdrop">
      {/* Decorative star glyphs — scattered behind the glass card */}
      {STAR_POSITIONS.map((pos, i) => (
        <StarGlyph
          key={i}
          size={pos.size}
          opacity={pos.opacity}
          animate
          style={{
            position: 'absolute',
            top: pos.top,
            left: (pos as Record<string, unknown>).left as string | undefined,
            right: (pos as Record<string, unknown>).right as string | undefined,
            bottom: (pos as Record<string, unknown>).bottom as string | undefined,
            animationDelay: pos.delay,
          }}
        />
      ))}

      <GlassCard width={460}>
        {/* Step content — card stays, content transitions */}
        <div
          key={step}
          style={{ minHeight: 320 }}
        >
          {stepContent}
        </div>

        {/* Step dots */}
        <StepDots current={step} />
      </GlassCard>
    </div>
  );
}
