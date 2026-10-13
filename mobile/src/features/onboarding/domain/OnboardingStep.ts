import { Money } from '@/core/domain/Money';

/** The big number that stars each step (layout "B · Cifra protagonista"). */
export type OnboardingFigure =
  | { readonly kind: 'money'; readonly amount: Money }
  | { readonly kind: 'percent'; readonly value: number };

export interface OnboardingStep {
  readonly id: string;
  readonly figure: OnboardingFigure;
  /** Small label under the figure. */
  readonly caption: string;
  readonly title: string;
  readonly description: string;
}

/**
 * Sample figures are consistent with the design canvas ("Casa Ana & Leo", October 2026):
 * 1.534,75 € left this month, spread over the 18 remaining days ≈ 85,26 € per day.
 */
export const onboardingSteps: readonly OnboardingStep[] = [
  {
    id: 'available',
    figure: { kind: 'money', amount: Money.ofMinor(153_475, 'EUR') },
    caption: 'disponible este mes',
    title: 'Sabe cuánto te queda',
    description: 'Tus ingresos y gastos del mes, resumidos en una sola cifra.',
  },
  {
    id: 'daily',
    figure: { kind: 'money', amount: Money.ofMinor(8_526, 'EUR') },
    caption: 'para gastar hoy',
    title: 'Gasta sin sorpresas',
    description: 'Calculamos cuánto puedes gastar cada día para llegar bien a fin de mes.',
  },
  {
    id: 'shared',
    figure: { kind: 'percent', value: 50 },
    caption: 'cada uno',
    title: 'Mejor en compañía',
    description: 'Comparte gastos con tu pareja, tu familia o tu piso y ajusta el reparto.',
  },
];
