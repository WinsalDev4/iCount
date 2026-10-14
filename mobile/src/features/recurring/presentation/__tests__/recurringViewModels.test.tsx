import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';

import { remindersPreferenceStore } from '../../data/remindersPreferenceStore';
import type { NewRecurringPayment } from '../../domain/RecurringPayment';
import { createRecurringTestKit } from '../../testing/recurringTestKit';
import { relativeDays } from '../recurringLabels';
import { useRecurringFormViewModel } from '../useRecurringFormViewModel';
import { useRecurringViewModel } from '../useRecurringViewModel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/core/auth/biometrics', () => ({ expoBiometrics: {} }));

// 14 October 2026. Only Date is faked, so TanStack Query's timers keep working.
beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(2026, 9, 14, 10),
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
    ],
  });
});
afterEach(() => jest.useRealTimers());

const eur = (cents: number) => Money.ofMinor(cents, 'EUR');
const payment = (extra: Partial<NewRecurringPayment> = {}): NewRecurringPayment => ({
  householdId: 'h1',
  name: 'Netflix',
  kind: 'subscription',
  type: 'expense',
  amount: eur(1_299),
  categoryId: 'leisure' as CategoryId,
  rule: { unit: 'month', interval: 1, dayOfMonth: 17 },
  startDate: new Date(2026, 0, 17),
  shared: false,
  ...extra,
});

async function kitWith(
  options: { remindersEnabled?: boolean } = {},
  ...items: NewRecurringPayment[]
) {
  const kit = createRecurringTestKit({ now: () => new Date() }, options);
  const payments = [];
  for (const item of items) payments.push(await kit.repository.create(item));
  return { ...kit, payments };
}

describe('relativeDays', () => {
  const today = new Date(2026, 9, 14, 23, 30);
  it.each([
    [new Date(2026, 9, 14), 'hoy'],
    [new Date(2026, 9, 15), 'mañana'],
    [new Date(2026, 9, 20), 'en 6 días'],
    [new Date(2026, 10, 1), 'en 18 días'],
    [new Date(2026, 9, 12), 'hace 2 días'],
  ])('%s → %s', (date, text) => {
    expect(relativeDays(date, today)).toBe(text);
  });
});

describe('useRecurringViewModel', () => {
  async function setup(
    options: { remindersEnabled?: boolean } = {},
    ...items: NewRecurringPayment[]
  ) {
    const kit = await kitWith(options, ...items);
    const hook = await renderHook(() => useRecurringViewModel(), { wrapper: kit.Wrapper });
    await waitFor(() => expect(hook.result.current.state.status).toBe('ready'));
    return { ...kit, hook };
  }
  const ready = (hook: Awaited<ReturnType<typeof setup>>['hook']) => {
    const { state } = hook.result.current;
    if (state.status !== 'ready') throw new Error(`expected ready, got ${state.status}`);
    return state;
  };

  it('lists what is due in the next 30 days, with the total of expenses', async () => {
    const { hook } = await setup(
      {},
      payment(),
      payment({
        name: 'Nómina',
        kind: 'income',
        type: 'income',
        amount: eur(195_000),
        rule: { unit: 'month', interval: 1, dayOfMonth: 28 },
      }),
    );
    const state = ready(hook);
    expect(state.upcoming.map((r) => r.name)).toEqual(['Netflix', 'Nómina']);
    expect(state.upcoming[0]).toMatchObject({
      amount: expect.stringMatching(/^-12,99/),
      tone: 'expense',
    });
    expect(state.upcoming[1]).toMatchObject({
      amount: expect.stringMatching(/^\+1\.?950,00/),
      tone: 'income',
    });
    expect(state.upcoming[0]?.when).toMatch(/en 3 días$/);
    // The 30-day window ends on 13 November, so the 17th of November is not in it.
    expect(state.next30DaysExpenses).toMatch(/^12,99/);
  });

  it('describes the payments themselves: kind, rule and next date', async () => {
    const { hook } = await setup(
      {},
      payment({ rule: { unit: 'month', interval: 3, dayOfMonth: 31 } }),
    );
    expect(ready(hook).payments[0]).toMatchObject({
      name: 'Netflix',
      kindLabel: 'Suscripción',
      rule: 'cada 3 meses, el último día',
    });
    expect(ready(hook).payments[0]?.next).toMatch(/^Próximo: /);
  });

  it('says nothing is due when there are no payments', async () => {
    const { hook } = await setup();
    const state = ready(hook);
    expect(state.upcoming).toEqual([]);
    expect(state.payments).toEqual([]);
    expect(state.next30DaysExpenses).toBeNull();
  });

  it('shows a friendly error when loading fails', async () => {
    const kit = createRecurringTestKit();
    jest.spyOn(kit.repository, 'list').mockRejectedValue(new Error('boom'));
    const hook = await renderHook(() => useRecurringViewModel(), { wrapper: kit.Wrapper });
    await waitFor(() => expect(hook.result.current.state.status).toBe('error'));
  });

  describe('calendar', () => {
    it('marks the days with payments, shows the month summary and the selected day', async () => {
      const { hook } = await setup(
        {},
        payment(),
        payment({
          name: 'Gimnasio',
          rule: { unit: 'month', interval: 1, dayOfMonth: 17 },
          amount: eur(3_000),
        }),
      );
      await act(async () => hook.result.current.selectTab('calendar'));
      await waitFor(() => expect(ready(hook).monthSummary).toMatch(/^Pagos del mes: /));

      const state = ready(hook);
      expect(state.monthLabel).toBe('octubre de 2026');
      const cells = state.weeks.flat().filter((c) => c !== null);
      const day17 = cells.find((c) => c.day === 17);
      expect(day17?.intensity).toBe(3); // two payments
      expect(day17?.accessibilityLabel).toMatch(/17: 2 vencimientos/);
      expect(cells.find((c) => c.day === 18)?.intensity).toBe(0);
      expect(cells.find((c) => c.isToday)?.day).toBe(14);
      expect(state.monthSummary).toMatch(/42,99/);

      await act(async () => hook.result.current.selectDay(new Date(2026, 9, 17)));
      expect(ready(hook).heading).toBe('sábado, 17 de octubre');
      expect(
        ready(hook)
          .dayRows.map((r) => r.name)
          .sort(),
      ).toEqual(['Gimnasio', 'Netflix']);
    });

    it('moves between months and picks a sensible day', async () => {
      const { hook } = await setup({}, payment());
      await act(async () => hook.result.current.selectTab('calendar'));
      await act(async () => hook.result.current.nextMonth());
      await waitFor(() => expect(ready(hook).monthLabel).toBe('noviembre de 2026'));
      expect(ready(hook).heading).toBe('domingo, 1 de noviembre');
      await act(async () => hook.result.current.previousMonth());
      await waitFor(() => expect(ready(hook).monthLabel).toBe('octubre de 2026'));
      expect(ready(hook).heading).toBe('miércoles, 14 de octubre');
    });

    it('a month without payments says so', async () => {
      const { hook } = await setup();
      await act(async () => hook.result.current.selectTab('calendar'));
      await waitFor(() => expect(ready(hook).monthSummary).toBe('Este mes no vence ningún pago'));
      expect(ready(hook).dayRows).toEqual([]);
    });
  });

  describe('reminders', () => {
    it('asks the OS in context when switched on, then schedules the reminders', async () => {
      const { hook, scheduler } = await setup({}, payment());
      scheduler.permissionNow = 'undetermined';
      expect(scheduler.requests).toHaveLength(0); // never at launch

      await act(async () => hook.result.current.setReminders(true));

      expect(scheduler.requests).toHaveLength(1);
      expect(remindersPreferenceStore.getState().enabled).toBe(true);
      expect(scheduler.replaced.at(-1)?.map((p) => p.fireAt)).toEqual([
        new Date(2026, 9, 16, 9),
        new Date(2026, 10, 16, 9),
      ]);
      expect(ready(hook).reminders).toMatchObject({ enabled: true, busy: false });
      expect(ready(hook).reminders.notice).toMatch(/9:00 del día antes/);
    });

    it('does not ask again when the permission was already granted', async () => {
      const { hook, scheduler } = await setup({}, payment());
      await act(async () => hook.result.current.setReminders(true));
      expect(scheduler.requests).toHaveLength(0);
      expect(remindersPreferenceStore.getState().enabled).toBe(true);
    });

    it('explains how to fix a refusal and stays off', async () => {
      const { hook, scheduler } = await setup({}, payment());
      scheduler.permissionNow = 'undetermined';
      scheduler.promptAnswer = 'denied';
      await act(async () => hook.result.current.setReminders(true));
      expect(remindersPreferenceStore.getState().enabled).toBe(false);
      expect(scheduler.replaced).toEqual([]);
      expect(ready(hook).reminders).toMatchObject({ enabled: false });
      expect(ready(hook).reminders.notice).toMatch(/Ajustes del teléfono/);
    });

    it('a permission denied for good is not even asked for', async () => {
      const { hook, scheduler } = await setup({}, payment());
      scheduler.permissionNow = 'denied';
      await act(async () => hook.result.current.setReminders(true));
      expect(scheduler.requests).toHaveLength(0);
      expect(ready(hook).reminders.notice).toMatch(/Ajustes del teléfono/);
    });

    it('switching off cancels what was scheduled', async () => {
      const { hook, scheduler } = await setup({ remindersEnabled: true }, payment());
      await act(async () => hook.result.current.setReminders(false));
      expect(scheduler.cancelAllCalls).toBe(1);
      expect(remindersPreferenceStore.getState().enabled).toBe(false);
    });

    it('survives a native failure with a message instead of crashing', async () => {
      const { hook, scheduler } = await setup({}, payment());
      scheduler.failReplace = true;
      await act(async () => hook.result.current.setReminders(true));
      expect(ready(hook).reminders.notice).toMatch(/No hemos podido programar/);
    });

    it('renews the reminders when the screen opens with them on', async () => {
      const { scheduler } = await setup({ remindersEnabled: true }, payment());
      await waitFor(() => expect(scheduler.replaced.length).toBeGreaterThan(0));
    });

    it('turns itself off if the OS permission was revoked meanwhile', async () => {
      const kit = await kitWith({ remindersEnabled: true }, payment());
      kit.scheduler.permissionNow = 'denied';
      const hook = await renderHook(() => useRecurringViewModel(), { wrapper: kit.Wrapper });
      await waitFor(() => expect(hook.result.current.state.status).toBe('ready'));
      await waitFor(() => expect(remindersPreferenceStore.getState().enabled).toBe(false));
      expect(kit.scheduler.replaced).toEqual([]);
    });
  });
});

describe('useRecurringFormViewModel', () => {
  async function setup(id?: string, ...items: NewRecurringPayment[]) {
    const kit = await kitWith({}, ...items);
    const paymentId = id === 'first' ? kit.payments[0]?.id : id;
    const hook = await renderHook(() => useRecurringFormViewModel(paymentId), {
      wrapper: kit.Wrapper,
    });
    await waitFor(() => expect(hook.result.current.state.status).not.toBe('loading'));
    return { ...kit, hook };
  }
  const ready = (hook: Awaited<ReturnType<typeof setup>>['hook']) => {
    const { state } = hook.result.current;
    if (state.status !== 'ready') throw new Error(`expected ready, got ${state.status}`);
    return state;
  };
  const fill = async (
    hook: Awaited<ReturnType<typeof setup>>['hook'],
    name: string,
    amount: string,
  ) => {
    await act(async () => hook.result.current.changeName(name));
    await act(async () => hook.result.current.changeAmount(amount));
  };

  it('starts empty: monthly bill with its usual category, cannot save yet', async () => {
    const { hook } = await setup();
    const state = ready(hook);
    expect(state).toMatchObject({ mode: 'create', name: '', canSave: false, canShare: true });
    expect(state.kinds.find((k) => k.selected)?.value).toBe('bill');
    expect(state.frequencies.find((f) => f.selected)?.value).toBe('monthly');
    expect(state.categories.find((c) => c.selected)?.value).toBe('bills');
    expect(state.categories.map((c) => c.value)).not.toContain('salary'); // incomes only
  });

  it('creates a payment whose rule is anchored on the first due date', async () => {
    const { hook, repository } = await setup();
    await fill(hook, 'Seguro', '480');
    await act(async () => hook.result.current.selectFrequency('yearly'));
    await act(async () => hook.result.current.shiftFirstDue(2)); // 14 December 2026
    expect(ready(hook).canSave).toBe(true);

    let saved = false;
    await act(async () => {
      saved = await hook.result.current.save();
    });

    expect(saved).toBe(true);
    const [created] = await repository.list('h1');
    expect(created).toMatchObject({
      name: 'Seguro',
      kind: 'bill',
      type: 'expense',
      categoryId: 'bills',
      shared: false,
      rule: { unit: 'year', interval: 1, dayOfMonth: 14, monthOfYear: 12 },
    });
    expect(created?.amount.amountMinor).toBe(48_000);
    expect(created?.startDate).toEqual(new Date(2026, 11, 14));
  });

  it('an income is created as income with an income category', async () => {
    const { hook, repository } = await setup();
    await fill(hook, 'Nómina', '1950');
    await act(async () => hook.result.current.selectKind('income'));
    expect(ready(hook).categories.find((c) => c.selected)?.value).toBe('salary');
    await act(async () => {
      await hook.result.current.save();
    });
    expect((await repository.list('h1'))[0]).toMatchObject({ type: 'income', kind: 'income' });
  });

  it('a new kind brings its own usual category', async () => {
    const { hook } = await setup();
    await act(async () => hook.result.current.selectCategory('food'));
    expect(ready(hook).categories.find((c) => c.selected)?.value).toBe('food');
    await act(async () => hook.result.current.selectKind('subscription'));
    expect(ready(hook).categories.find((c) => c.selected)?.value).toBe('leisure');
  });

  it('moves the first due date by days and months, and shares with the household', async () => {
    const { hook, repository } = await setup();
    await fill(hook, 'Cuota', '10');
    await act(async () => hook.result.current.shiftFirstDueDays(17)); // 31 October
    await act(async () => hook.result.current.shiftFirstDue(1)); // 30 November (day kept when it fits)
    expect(ready(hook).firstDueLabel).toBe('30 de noviembre de 2026');
    await act(async () => hook.result.current.setShared(true));
    await act(async () => {
      await hook.result.current.save();
    });
    expect((await repository.list('h1'))[0]).toMatchObject({
      shared: true,
      rule: { unit: 'month', interval: 1, dayOfMonth: 30 },
    });
  });

  it('flags a bad amount while typing', async () => {
    const { hook } = await setup();
    await act(async () => hook.result.current.changeAmount('mucho'));
    expect(ready(hook).amountError).toMatch(/importe mayor que cero/);
    expect(ready(hook).canSave).toBe(false);
    await act(async () => hook.result.current.changeAmount('0'));
    expect(ready(hook).amountError).not.toBeNull();
  });

  it('shows a friendly error when saving fails', async () => {
    const { hook, repository } = await setup();
    jest.spyOn(repository, 'create').mockRejectedValue(new Error('boom'));
    await fill(hook, 'Seguro', '480');
    let saved = true;
    await act(async () => {
      saved = await hook.result.current.save();
    });
    expect(saved).toBe(false);
    expect(ready(hook).error).toBe('Algo ha salido mal. Inténtalo de nuevo.');
  });

  describe('editing', () => {
    it('loads the stored payment and offers only the kinds of its type', async () => {
      const { hook } = await setup('first', payment({ shared: true }));
      const state = ready(hook);
      expect(state).toMatchObject({
        mode: 'edit',
        name: 'Netflix',
        amountText: '12,99',
        shared: true,
        canSave: true,
      });
      expect(state.frequencies.find((f) => f.selected)?.value).toBe('monthly');
      expect(state.categories.find((c) => c.selected)?.value).toBe('leisure');
      expect(state.kinds.map((k) => k.value)).toEqual(['bill', 'loan', 'subscription', 'other']);
      expect(state.firstDueLabel).toBe('17 de enero de 2026');
    });

    it('saves the changes, changing the periodicity but not the day', async () => {
      const { hook, repository, payments } = await setup(
        'first',
        payment({ rule: { unit: 'month', interval: 1, dayOfMonth: 31 } }),
      );
      await act(async () => hook.result.current.changeName('Netflix 4K'));
      await act(async () => hook.result.current.changeAmount('17,99'));
      await act(async () => hook.result.current.selectFrequency('quarterly'));
      await act(async () => {
        await hook.result.current.save();
      });
      const updated = (await repository.list('h1')).find((p) => p.id === payments[0]?.id);
      expect(updated).toMatchObject({
        name: 'Netflix 4K',
        rule: { unit: 'month', interval: 3, dayOfMonth: 31 },
      });
      expect(updated?.amount.amountMinor).toBe(1_799);
    });

    it('leaves a custom rule alone unless a frequency is picked', async () => {
      const custom = payment({ rule: { unit: 'month', interval: 2, dayOfMonth: 9 } });
      const { hook, repository } = await setup('first', custom);
      expect(ready(hook).frequencies.some((f) => f.selected)).toBe(false);
      expect(ready(hook).canSave).toBe(false); // pick a frequency to confirm
      await act(async () => hook.result.current.selectFrequency('monthly'));
      await act(async () => {
        await hook.result.current.save();
      });
      expect((await repository.list('h1'))[0]?.rule).toEqual({
        unit: 'month',
        interval: 1,
        dayOfMonth: 9,
      });
    });

    it('asks before deleting, and deletes', async () => {
      const { hook, repository } = await setup('first', payment());
      await act(async () => hook.result.current.requestDelete());
      expect(ready(hook).confirmingDelete).toBe(true);
      await act(async () => hook.result.current.cancelDelete());
      expect(ready(hook).confirmingDelete).toBe(false);
      expect(await repository.list('h1')).toHaveLength(1);

      await act(async () => hook.result.current.requestDelete());
      let deleted = false;
      await act(async () => {
        deleted = await hook.result.current.confirmDelete();
      });
      expect(deleted).toBe(true);
      expect(await repository.list('h1')).toEqual([]);
    });

    it('explains a payment that no longer exists', async () => {
      const { hook } = await setup('nope');
      expect(hook.result.current.state.status).toBe('not-found');
    });
  });
});
