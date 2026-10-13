import { useCallback, useMemo, useState } from 'react';

import { useOnboardingStore } from '../data/onboardingStore';
import { onboardingSteps, type OnboardingFigure } from '../domain/OnboardingStep';
import { clampStep, isLastStep } from '../domain/stepNavigation';

export interface StepUi {
  readonly id: string;
  /** Ready to print: "1.534,75 €" or "50 %". */
  readonly figure: string;
  readonly caption: string;
  readonly title: string;
  readonly description: string;
}

export type OnboardingUiState =
  | { readonly status: 'loading' }
  | { readonly status: 'completed' }
  | {
      readonly status: 'active';
      readonly steps: readonly StepUi[];
      readonly stepIndex: number;
      readonly isLast: boolean;
      readonly primaryLabel: string;
      /** "Saltar" disappears on the last step, where the primary button already finishes. */
      readonly canSkip: boolean;
    };

function formatFigure(figure: OnboardingFigure): string {
  return figure.kind === 'money' ? figure.amount.format() : `${figure.value} %`;
}

const stepsUi: readonly StepUi[] = onboardingSteps.map((step) => ({
  id: step.id,
  figure: formatFigure(step.figure),
  caption: step.caption,
  title: step.title,
  description: step.description,
}));

/**
 * ViewModel of the onboarding (MVVM): which step is showing, what the buttons say and
 * when the intro is done. It does not navigate: when `status` becomes 'completed' the View
 * redirects. Kotlin analogy: a ViewModel exposing StateFlow<UiState> + onNext()/onSkip().
 */
export function useOnboardingViewModel() {
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const completed = useOnboardingStore((s) => s.onboardingCompleted);
  const complete = useOnboardingStore((s) => s.complete);
  const [stepIndex, setStepIndex] = useState(0);
  const total = stepsUi.length;

  const state = useMemo<OnboardingUiState>(() => {
    if (!hydrated) return { status: 'loading' };
    if (completed) return { status: 'completed' };
    const isLast = isLastStep(stepIndex, total);
    return {
      status: 'active',
      steps: stepsUi,
      stepIndex,
      isLast,
      primaryLabel: isLast ? 'Empezar' : 'Siguiente',
      canSkip: !isLast,
    };
  }, [hydrated, completed, stepIndex, total]);

  /** Jump to a page (swipe or dot). Out-of-range values are clamped. */
  const goTo = useCallback((index: number) => setStepIndex(clampStep(index, total)), [total]);

  /** "Siguiente" advances; on the last step it is "Empezar" and finishes. */
  const next = useCallback(() => {
    if (isLastStep(stepIndex, total)) complete();
    else setStepIndex(clampStep(stepIndex + 1, total));
  }, [stepIndex, total, complete]);

  const skip = useCallback(() => complete(), [complete]);

  return { state, next, skip, goTo };
}
