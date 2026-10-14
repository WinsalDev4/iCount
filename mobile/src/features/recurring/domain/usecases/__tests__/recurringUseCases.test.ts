import type { CategoryId } from '@/core/domain/Category';
import { Money } from '@/core/domain/Money';

import { InMemoryRecurringRepository } from '../../../data/InMemoryRecurringRepository';
import { RecurringError } from '../../RecurringError';
import type { NewRecurringPayment } from '../../RecurringPayment';
import type { ReminderPlan, RemindersScheduler } from '../../RemindersScheduler';
import {
  CreateRecurringPayment,
  DeleteRecurringPayment,
  ListRecurringPayments,
  ListUpcomingDues,
  SyncReminders,
  UpdateRecurringPayment,
} from '../RecurringUseCases';

const NOW = new Date(2026, 9, 14, 10);
const make = () => new InMemoryRecurringRepository({ payments: [], now: () => NOW });

const valid: NewRecurringPayment = {
  householdId: 'h1',
  name: '  Netflix  ',
  kind: 'subscription',
  type: 'expense',
  amount: Money.ofMinor(1_299, 'EUR'),
  categoryId: 'leisure' as CategoryId,
  rule: { unit: 'month', interval: 1, dayOfMonth: 17 },
  startDate: new Date(2026, 0, 17),
  shared: false,
};

describe('CreateRecurringPayment', () => {
  it('tidies the name and creates', async () => {
    const created = await new CreateRecurringPayment(make()).execute({
      ...valid,
      name: '  Mi   Netflix ',
    });
    expect(created.name).toBe('Mi Netflix');
  });

  it.each([
    ['empty name', { name: '   ' }],
    ['name too long', { name: 'x'.repeat(61) }],
    ['zero amount', { amount: Money.ofMinor(0, 'EUR') }],
    ['negative amount', { amount: Money.ofMinor(-5, 'EUR') }],
    ['interval 0', { rule: { unit: 'month', interval: 0, dayOfMonth: 5 } }],
    ['interval above 24', { rule: { unit: 'month', interval: 25, dayOfMonth: 5 } }],
    ['day 32', { rule: { unit: 'month', interval: 1, dayOfMonth: 32 } }],
    ['yearly without month', { rule: { unit: 'year', interval: 1, dayOfMonth: 5 } }],
    [
      'monthly with a month',
      { rule: { unit: 'month', interval: 1, dayOfMonth: 5, monthOfYear: 3 } },
    ],
    ['end before start', { endDate: new Date(2025, 0, 1) }],
  ] as const)('rejects %s', async (_label, patch) => {
    await expect(
      new CreateRecurringPayment(make()).execute({ ...valid, ...patch } as NewRecurringPayment),
    ).rejects.toEqual(new RecurringError('invalid'));
  });
});

describe('UpdateRecurringPayment', () => {
  it('validates the changes it receives', async () => {
    const repository = make();
    const { id } = await repository.create(valid);
    const update = new UpdateRecurringPayment(repository);
    await expect(update.execute(id, { name: '' })).rejects.toEqual(new RecurringError('invalid'));
    await expect(update.execute(id, { amount: Money.ofMinor(0, 'EUR') })).rejects.toEqual(
      new RecurringError('invalid'),
    );
    await expect(
      update.execute(id, { rule: { unit: 'year', interval: 1, dayOfMonth: 1 } }),
    ).rejects.toEqual(new RecurringError('invalid'));
    expect((await update.execute(id, { name: ' Disney+ ' })).name).toBe('Disney+');
  });
});

describe('ListRecurringPayments', () => {
  it('puts the soonest due first and the ended ones last', async () => {
    const repository = make();
    await repository.create({ ...valid, name: 'Tarde', rule: { ...valid.rule, dayOfMonth: 28 } });
    await repository.create({ ...valid, name: 'Pronto', rule: { ...valid.rule, dayOfMonth: 15 } });
    await repository.create({ ...valid, name: 'Acabado', endDate: new Date(2026, 5, 1) });
    const names = (await new ListRecurringPayments(repository).execute('h1')).map((p) => p.name);
    expect(names).toEqual(['Pronto', 'Tarde', 'Acabado']);
  });
});

describe('DeleteRecurringPayment / ListUpcomingDues', () => {
  it('deletes through the repository', async () => {
    const repository = make();
    const { id } = await repository.create(valid);
    await new DeleteRecurringPayment(repository).execute(id);
    expect(await repository.list('h1')).toEqual([]);
  });

  it('rejects a backwards range', async () => {
    await expect(
      new ListUpcomingDues(make()).execute('h1', new Date(2026, 10, 1), new Date(2026, 9, 1)),
    ).rejects.toEqual(new RecurringError('invalid'));
  });
});

describe('SyncReminders', () => {
  function fakeScheduler() {
    const calls: (readonly ReminderPlan[])[] = [];
    const scheduler: Pick<RemindersScheduler, 'replaceAll'> = {
      replaceAll: async (plans) => {
        calls.push(plans);
      },
    };
    return { scheduler, calls };
  }

  it('schedules one reminder per expense due in the next 45 days, never for incomes', async () => {
    const repository = make();
    await repository.create(valid); // 17th every month
    await repository.create({
      ...valid,
      name: 'Nómina',
      type: 'income',
      kind: 'income',
      rule: { ...valid.rule, dayOfMonth: 28 },
    });
    const { scheduler, calls } = fakeScheduler();

    const scheduled = await new SyncReminders(repository, scheduler).execute('h1', NOW);

    // 17 Oct (reminder 16 Oct 09:00) and 17 Nov (16 Nov); 17 Dec is beyond 45 days.
    expect(scheduled).toBe(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.map((p) => p.fireAt)).toEqual([
      new Date(2026, 9, 16, 9),
      new Date(2026, 10, 16, 9),
    ]);
  });

  it('replaces with an empty list when nothing is due, so old reminders disappear', async () => {
    const { scheduler, calls } = fakeScheduler();
    expect(await new SyncReminders(make(), scheduler).execute('h1', NOW)).toBe(0);
    expect(calls).toEqual([[]]);
  });
});
