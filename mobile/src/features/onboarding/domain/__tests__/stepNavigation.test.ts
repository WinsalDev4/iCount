import { onboardingSteps } from '../OnboardingStep';
import { clampStep, isLastStep, stepFromOffset } from '../stepNavigation';

describe('clampStep', () => {
  it('keeps valid indexes', () => {
    expect(clampStep(0, 3)).toBe(0);
    expect(clampStep(2, 3)).toBe(2);
  });

  it('clamps out-of-range indexes', () => {
    expect(clampStep(-1, 3)).toBe(0);
    expect(clampStep(7, 3)).toBe(2);
  });

  it('rounds fractional indexes (mid-swipe)', () => {
    expect(clampStep(0.4, 3)).toBe(0);
    expect(clampStep(1.6, 3)).toBe(2);
  });

  it('survives NaN, Infinity and an empty list', () => {
    expect(clampStep(Number.NaN, 3)).toBe(0);
    expect(clampStep(Number.POSITIVE_INFINITY, 3)).toBe(0);
    expect(clampStep(2, 0)).toBe(0);
  });
});

describe('isLastStep', () => {
  it('is true only on the last page', () => {
    expect(isLastStep(0, 3)).toBe(false);
    expect(isLastStep(1, 3)).toBe(false);
    expect(isLastStep(2, 3)).toBe(true);
  });

  it('is false for an empty pager', () => {
    expect(isLastStep(0, 0)).toBe(false);
  });
});

describe('stepFromOffset', () => {
  it('maps a scroll offset to a page', () => {
    expect(stepFromOffset(0, 390, 3)).toBe(0);
    expect(stepFromOffset(390, 390, 3)).toBe(1);
    expect(stepFromOffset(780, 390, 3)).toBe(2);
  });

  it('snaps to the nearest page', () => {
    expect(stepFromOffset(150, 390, 3)).toBe(0);
    expect(stepFromOffset(250, 390, 3)).toBe(1);
  });

  it('clamps overscroll and ignores a zero width', () => {
    expect(stepFromOffset(5000, 390, 3)).toBe(2);
    expect(stepFromOffset(-40, 390, 3)).toBe(0);
    expect(stepFromOffset(100, 0, 3)).toBe(0);
  });
});

describe('onboardingSteps', () => {
  it('has three steps with unique ids and complete copy', () => {
    expect(onboardingSteps).toHaveLength(3);
    expect(new Set(onboardingSteps.map((s) => s.id)).size).toBe(3);
    for (const step of onboardingSteps) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
      expect(step.caption.length).toBeGreaterThan(0);
    }
  });

  it('keeps money figures in minor units', () => {
    for (const step of onboardingSteps) {
      if (step.figure.kind === 'money') {
        expect(Number.isInteger(step.figure.amount.amountMinor)).toBe(true);
      }
    }
  });
});
