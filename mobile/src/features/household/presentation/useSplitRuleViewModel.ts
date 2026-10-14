import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useDependencies } from '@/core/di/DependenciesProvider';
import { BUILT_IN_CATEGORY_IDS } from '@/core/domain/Category';
import type { HouseholdId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';
import { parseAmountInput } from '@/shared/format/parseAmountInput';

import { setupStore } from '../data/setupStore';
import type { Household } from '../domain/Household';
import { previewSplit, type PreviewMember } from '../domain/previewSplit';
import { FULL_SHARE_BASIS_POINTS, type SplitRule } from '../domain/SplitRule';
import { householdErrorMessage } from './householdMessages';
import { upsertHousehold, useMyHouseholds } from './households';

export type SplitChoice = SplitRule['kind'];

export interface PreviewRow {
  readonly label: string;
  readonly amount: string;
  /** "50 %" */
  readonly percent: string;
}

export type SplitRuleUiState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly choice: SplitChoice;
      /** A custom split needs exactly two members; with fewer it stays for later. */
      readonly customAvailable: boolean;
      readonly myIncome: string;
      readonly otherIncome: string;
      readonly otherLabel: string;
      /** Your part of a custom split, 0–100. */
      readonly myPercent: number;
      readonly sampleExpense: string;
      readonly preview: readonly PreviewRow[];
      /** Why the preview is not literally the chosen rule (income missing), if so. */
      readonly previewNote: string | null;
      readonly saving: boolean;
      readonly error: string | null;
    };

const SAMPLE_EXPENSE = Money.ofMinor(10_000, 'EUR');
const STEP_BASIS_POINTS = 500;
/** Categories a custom split covers: everything you can spend on. */
const EXPENSE_CATEGORIES = BUILT_IN_CATEGORY_IDS.filter((id) => id !== 'salary');

function labelOf(member: { displayName: string | null; email: string }): string {
  return member.displayName ?? member.email.split('@')[0] ?? member.email;
}

/**
 * ViewModel of the split-rule step: pick equal / by income / custom and see what a 100 € expense
 * would cost each person. Saving applies the rule (and the income, when it matters) and ends
 * the setup, which lets the access gate open the app.
 */
export function useSplitRuleViewModel(householdId: HouseholdId | undefined) {
  const { setSplitRule, setMyIncome } = useDependencies().household;
  const queryClient = useQueryClient();
  const households = useMyHouseholds();
  const household: Household | undefined = households.data?.find((h) => h.id === householdId);

  const [choice, setChoice] = useState<SplitChoice>('equal');
  const [myIncome, setMyIncomeText] = useState('');
  const [otherIncome, setOtherIncomeText] = useState('');
  const [myBasisPoints, setMyBasisPoints] = useState(FULL_SHARE_BASIS_POINTS / 2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Me" is the first member: the creator of a new household. Joiners never reach this step.
  const me = household?.members[0];
  const others = useMemo(() => household?.members.slice(1) ?? [], [household]);
  const other = others[0];
  const customAvailable = household !== undefined && household.members.length === 2;

  const parsedMine = parseAmountInput(myIncome);
  const parsedOther = parseAmountInput(otherIncome);

  const rule = useMemo<SplitRule>(() => {
    if (choice !== 'custom' || !me || !other) {
      return choice === 'income-proportional' ? { kind: 'income-proportional' } : { kind: 'equal' };
    }
    const shares = [
      { memberId: me.userId, basisPoints: myBasisPoints },
      { memberId: other.userId, basisPoints: FULL_SHARE_BASIS_POINTS - myBasisPoints },
    ];
    return {
      kind: 'custom',
      categories: EXPENSE_CATEGORIES.map((categoryId) => ({ categoryId, shares })),
    };
  }, [choice, me, other, myBasisPoints]);

  const state = useMemo<SplitRuleUiState>(() => {
    if (!household || !me) return { status: 'loading' };

    // A household with one member is previewed against a made-up second person.
    const members: PreviewMember[] = [
      {
        id: me.userId,
        label: 'Tú',
        monthlyIncome: parsedMine.ok ? parsedMine.amount : me.monthlyIncome,
      },
      {
        id: other?.userId ?? 'other',
        label: other ? labelOf(other) : 'Otra persona',
        monthlyIncome: parsedOther.ok ? parsedOther.amount : (other?.monthlyIncome ?? null),
      },
    ];
    const result = previewSplit(rule, members, SAMPLE_EXPENSE, EXPENSE_CATEGORIES[0]);

    return {
      status: 'ready',
      choice,
      customAvailable,
      myIncome,
      otherIncome,
      otherLabel: members[1]?.label ?? 'Otra persona',
      myPercent: myBasisPoints / 100,
      sampleExpense: SAMPLE_EXPENSE.format(),
      preview: result.shares.map((share) => ({
        label: share.label,
        amount: share.amount.format(),
        percent: `${share.basisPoints / 100} %`,
      })),
      previewNote:
        result.fallback === 'income-missing'
          ? 'Escribe los ingresos de las dos personas para ver el reparto proporcional; mientras tanto se muestra a partes iguales.'
          : null,
      saving,
      error,
    };
  }, [
    household,
    me,
    other,
    rule,
    choice,
    customAvailable,
    myIncome,
    otherIncome,
    parsedMine,
    parsedOther,
    myBasisPoints,
    saving,
    error,
  ]);

  const choose = useCallback((next: SplitChoice) => {
    setChoice(next);
    setError(null);
  }, []);

  const setMyIncome_ = useCallback((value: string) => {
    setMyIncomeText(value);
    setError(null);
  }, []);
  const setOtherIncome = useCallback((value: string) => {
    setOtherIncomeText(value);
    setError(null);
  }, []);

  /** Your part of a custom split moves in 5 % steps and stays within 0–100 %. */
  const adjustMyShare = useCallback((direction: 1 | -1) => {
    setMyBasisPoints((current) =>
      Math.min(FULL_SHARE_BASIS_POINTS, Math.max(0, current + direction * STEP_BASIS_POINTS)),
    );
  }, []);

  /** Applies the rule and ends the setup. Resolves true when it worked. */
  const save = useCallback(async (): Promise<boolean> => {
    if (!household) return false;
    setSaving(true);
    setError(null);
    try {
      let updated = household;
      if (choice === 'income-proportional' && parsedMine.ok) {
        updated = await setMyIncome.execute(household.id, parsedMine.amount);
      }
      updated = await setSplitRule.execute(household.id, rule);
      upsertHousehold(queryClient, updated);
      setupStore.getState().finish();
      return true;
    } catch (e) {
      setError(householdErrorMessage(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, [household, choice, parsedMine, rule, setMyIncome, setSplitRule, queryClient]);

  /** "Más tarde": keep the default equal split and open the app. */
  const skip = useCallback(() => {
    setupStore.getState().finish();
  }, []);

  return {
    state,
    choose,
    setMyIncome: setMyIncome_,
    setOtherIncome,
    adjustMyShare,
    save,
    skip,
  };
}
