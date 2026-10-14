import { act, renderHook } from '@testing-library/react-native';

import type { HouseholdId, UserId } from '@/core/domain/Ids';
import { Money } from '@/core/domain/Money';
import { queryKeys } from '@/core/query/queryKeys';

import { setupStore } from '../../data/setupStore';
import type { Household } from '../../domain/Household';
import { HouseholdError } from '../../domain/HouseholdError';
import type { HouseholdRepository } from '../../domain/HouseholdRepository';
import { createHouseholdTestKit } from '../../testing/householdTestKit';
import { useSplitRuleViewModel } from '../useSplitRuleViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

const me = 'user-me' as UserId;
const ana = 'user-ana' as UserId;

const soloHousehold: Household = {
  id: 'h1' as HouseholdId,
  name: 'Casa',
  kind: 'shared',
  currency: 'EUR',
  splitRule: { kind: 'equal' },
  members: [
    { userId: me, email: 'tu@icount.app', displayName: null, role: 'admin', monthlyIncome: null },
  ],
};

const coupleHousehold: Household = {
  ...soloHousehold,
  members: [
    ...soloHousehold.members,
    {
      userId: ana,
      email: 'ana@casa.app',
      displayName: 'Ana',
      role: 'member',
      monthlyIncome: Money.ofMinor(200_000, 'EUR'),
    },
  ],
};

/** The in-memory repository, started with a household that already exists. */
async function start(household: Household) {
  const kit = createHouseholdTestKit();
  const repository = kit.repository as unknown as {
    households: Household[];
  } & HouseholdRepository;
  repository.households = [household];
  kit.queryClient.setQueryData(queryKeys.households.mine(), [household]);
  setupStore.setState({ pendingHouseholdId: household.id });
  const hook = await renderHook(() => useSplitRuleViewModel(household.id), {
    wrapper: kit.Wrapper,
  });
  return { ...kit, hook };
}

function ready(hook: Awaited<ReturnType<typeof start>>['hook']) {
  const { state } = hook.result.current;
  if (state.status !== 'ready') throw new Error('expected ready');
  return state;
}

beforeEach(() => setupStore.setState({ pendingHouseholdId: null }));

describe('useSplitRuleViewModel', () => {
  it('is loading while the household is unknown', async () => {
    const kit = createHouseholdTestKit();
    const { result } = await renderHook(() => useSplitRuleViewModel('nope' as HouseholdId), {
      wrapper: kit.Wrapper,
    });
    expect(result.current.state.status).toBe('loading');
  });

  it('starts equal, previewing a 100 € expense against a made-up second person', async () => {
    const { hook } = await start(soloHousehold);
    const state = ready(hook);
    expect(state.choice).toBe('equal');
    expect(state.sampleExpense).toContain('100');
    expect(state.preview).toEqual([
      { label: 'Tú', amount: expect.stringContaining('50,00'), percent: '50 %' },
      { label: 'Otra persona', amount: expect.stringContaining('50,00'), percent: '50 %' },
    ]);
    expect(state.previewNote).toBeNull();
  });

  it('keeps the custom split for later while nobody else is a member', async () => {
    const { hook } = await start(soloHousehold);
    expect(ready(hook).customAvailable).toBe(false);
  });

  it('proportional preview: asks for incomes, then splits by them', async () => {
    const { hook } = await start(soloHousehold);
    await act(async () => hook.result.current.choose('income-proportional'));
    expect(ready(hook).previewNote).toContain('ingresos');
    expect(ready(hook).preview.map((r) => r.percent)).toEqual(['50 %', '50 %']);

    await act(async () => hook.result.current.setMyIncome('1.850'));
    await act(async () => hook.result.current.setOtherIncome('2.000,00'));
    const state = ready(hook);
    expect(state.previewNote).toBeNull();
    expect(state.preview.map((r) => r.percent)).toEqual(['48.05 %', '51.95 %']);
    expect(state.preview.map((r) => r.amount).join(' ')).toMatch(/48,05.*51,95/);
  });

  it('ignores income text that is not a valid amount', async () => {
    const { hook } = await start(soloHousehold);
    await act(async () => hook.result.current.choose('income-proportional'));
    await act(async () => hook.result.current.setMyIncome('mucho'));
    await act(async () => hook.result.current.setOtherIncome('2.000'));
    expect(ready(hook).previewNote).not.toBeNull();
  });

  it('uses the real partner (name and declared income) once somebody joined', async () => {
    const { hook } = await start(coupleHousehold);
    const state = ready(hook);
    expect(state.customAvailable).toBe(true);
    expect(state.otherLabel).toBe('Ana');
    expect(state.preview.map((r) => r.label)).toEqual(['Tú', 'Ana']);

    await act(async () => hook.result.current.choose('income-proportional'));
    await act(async () => hook.result.current.setMyIncome('1.850'));
    expect(ready(hook).previewNote).toBeNull(); // Ana's income is already declared
  });

  it('custom: my part moves in 5 % steps within 0–100 % and the preview follows', async () => {
    const { hook } = await start(coupleHousehold);
    await act(async () => hook.result.current.choose('custom'));
    expect(ready(hook).myPercent).toBe(50);

    await act(async () => hook.result.current.adjustMyShare(1));
    await act(async () => hook.result.current.adjustMyShare(1));
    expect(ready(hook).myPercent).toBe(60);
    expect(ready(hook).preview.map((r) => r.percent)).toEqual(['60 %', '40 %']);

    for (let i = 0; i < 30; i++) await act(async () => hook.result.current.adjustMyShare(1));
    expect(ready(hook).myPercent).toBe(100);
    for (let i = 0; i < 30; i++) await act(async () => hook.result.current.adjustMyShare(-1));
    expect(ready(hook).myPercent).toBe(0);
  });

  it('saves equal: sets the rule and ends the setup', async () => {
    const kit = await start(soloHousehold);
    const set = jest.spyOn(kit.repository, 'setSplitRule');
    let ok = false;
    await act(async () => {
      ok = await kit.hook.result.current.save();
    });
    expect(ok).toBe(true);
    expect(set).toHaveBeenCalledWith(soloHousehold.id, { kind: 'equal' });
    expect(setupStore.getState().pendingHouseholdId).toBeNull();
  });

  it('saves proportional together with my declared income', async () => {
    const kit = await start(soloHousehold);
    const income = jest.spyOn(kit.repository, 'setMyIncome');
    const set = jest.spyOn(kit.repository, 'setSplitRule');
    await act(async () => kit.hook.result.current.choose('income-proportional'));
    await act(async () => kit.hook.result.current.setMyIncome('1.850,00'));
    await act(async () => void (await kit.hook.result.current.save()));

    expect(income).toHaveBeenCalledWith(soloHousehold.id, Money.ofMinor(185_000, 'EUR'));
    expect(set).toHaveBeenCalledWith(soloHousehold.id, { kind: 'income-proportional' });
    const stored = kit.queryClient.getQueryData<readonly Household[]>(queryKeys.households.mine());
    expect(stored?.[0]?.splitRule).toEqual({ kind: 'income-proportional' });
    expect(stored?.[0]?.members[0]?.monthlyIncome?.amountMinor).toBe(185_000);
  });

  it('saves a custom split as shares of 100 % for every expense category', async () => {
    const kit = await start(coupleHousehold);
    const set = jest.spyOn(kit.repository, 'setSplitRule');
    await act(async () => kit.hook.result.current.choose('custom'));
    await act(async () => kit.hook.result.current.adjustMyShare(-1)); // 45 %
    await act(async () => void (await kit.hook.result.current.save()));

    const rule = set.mock.calls[0]?.[1];
    expect(rule?.kind).toBe('custom');
    if (rule?.kind !== 'custom') throw new Error('expected custom');
    expect(rule.categories.map((c) => c.categoryId)).not.toContain('salary');
    expect(rule.categories.length).toBeGreaterThanOrEqual(8);
    for (const category of rule.categories) {
      expect(category.shares).toEqual([
        { memberId: me, basisPoints: 4_500 },
        { memberId: ana, basisPoints: 5_500 },
      ]);
    }
  });

  it('stays on the step with the reason when saving fails', async () => {
    const kit = await start(soloHousehold);
    jest.spyOn(kit.repository, 'setSplitRule').mockRejectedValue(new HouseholdError('forbidden'));
    let ok = true;
    await act(async () => {
      ok = await kit.hook.result.current.save();
    });
    expect(ok).toBe(false);
    expect(ready(kit.hook).error).toContain('administra');
    expect(setupStore.getState().pendingHouseholdId).toBe(soloHousehold.id);
    expect(ready(kit.hook).saving).toBe(false);
  });

  it('"Más tarde" keeps the default and ends the setup without calling the API', async () => {
    const kit = await start(soloHousehold);
    const set = jest.spyOn(kit.repository, 'setSplitRule');
    await act(async () => kit.hook.result.current.skip());
    expect(set).not.toHaveBeenCalled();
    expect(setupStore.getState().pendingHouseholdId).toBeNull();
  });
});
