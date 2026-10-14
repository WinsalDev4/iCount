import type { UserId } from '@/core/domain/Ids';

import type { ActivityItem } from '../../domain/Activity';
import { ActivityError } from '../../domain/ActivityError';
import { activityErrorMessage, describeActivity, formatWhen } from '../activityText';

const ME = 'me' as UserId;
const ANA = 'ana' as UserId;
const nameOf = (id: string) => (id === 'me' ? 'Tú' : id === 'ana' ? 'Ana' : 'Alguien');
const item = (extra: Partial<ActivityItem>): ActivityItem => ({
  id: 'i',
  type: 'transaction-created',
  actorId: ANA,
  occurredAt: new Date(2026, 9, 14),
  transactionId: 't',
  settlementId: null,
  amount: null,
  description: 'Compra',
  approval: null,
  commentCount: 0,
  ...extra,
});

describe('describeActivity', () => {
  it.each([
    ['transaction-created', ANA, 'Ana añadió «Compra»'],
    ['transaction-created', ME, 'Tú añadiste «Compra»'],
    ['transaction-approved', ME, 'Tú aprobaste «Compra»'],
    ['transaction-rejected', ANA, 'Ana rechazó «Compra»'],
    ['transaction-updated', ANA, 'Ana editó «Compra»'],
    ['transaction-deleted', ME, 'Tú eliminaste «Compra»'],
    ['comment-added', ANA, 'Ana comentó en «Compra»'],
    ['settlement-created', ME, 'Tú registraste un pago para saldar cuentas'],
    ['member-joined', ANA, 'Ana se unió al hogar'],
    ['unknown', ANA, 'Ana hizo un cambio en el hogar'],
  ] as const)('%s by %s → %s', (type, actorId, text) => {
    expect(describeActivity(item({ type, actorId }), nameOf)).toBe(text);
  });

  it('copes with a movement without description', () => {
    expect(describeActivity(item({ description: null }), nameOf)).toBe('Ana añadió un movimiento');
  });
});

describe('formatWhen', () => {
  const today = new Date(2026, 9, 14, 23, 30);
  it.each([
    [new Date(2026, 9, 14), 'hoy'],
    [new Date(2026, 9, 13), 'ayer'],
    [new Date(2026, 9, 10), 'hace 4 días'],
    [new Date(2026, 8, 20), '20 sept'],
  ])('%s → %s', (date, text) => {
    expect(formatWhen(date, today).replace('.', '')).toBe(text);
  });
});

describe('activityErrorMessage', () => {
  it('explains the expected failures and hides the unexpected ones', () => {
    expect(activityErrorMessage(new ActivityError('cannot-approve-own'))).toMatch(/propios/);
    expect(activityErrorMessage(new ActivityError('already-decided'))).toMatch(/ya ha decidido/);
    expect(activityErrorMessage(new Error('stack trace'))).toBe(
      'Algo ha salido mal. Inténtalo de nuevo.',
    );
  });
});
