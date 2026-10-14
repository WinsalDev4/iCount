import { formatMoney } from '../../../shared/application/format-money.js';
import type { Household } from '../../households/domain/household.js';
import type { PushNotification } from '../../push/domain/push.js';
import type { Transaction } from '../domain/transaction.js';

/**
 * Push for the members who must approve a shared movement (ADR-0016/0017).
 * Only the movement's name and amount: the lock screen is public.
 */
export function approvalPush(
  event: 'shared-expense' | 'approval-pending',
  transaction: Transaction,
  household: Household,
): PushNotification | null {
  if (transaction.snapshot.approvalStatus !== 'pending') return null;
  const { description, amountMinor, currency } = transaction.snapshot;
  const what = `«${description || 'Sin concepto'}» · ${formatMoney(amountMinor, currency)}`;
  return event === 'shared-expense'
    ? {
        recipients: transaction.approvers,
        event,
        title: `Nuevo gasto compartido en ${household.name}`,
        body: `${what}. Revísalo para que cuente en el balance.`,
        url: '/household?filter=to-review',
      }
    : {
        recipients: transaction.approvers,
        event,
        title: `Gasto modificado en ${household.name}`,
        body: `${what}. Ha cambiado y necesita tu aprobación otra vez.`,
        url: '/household?filter=to-review',
      };
}
