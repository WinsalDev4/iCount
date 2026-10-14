import { ActivityError, type ActivityErrorReason } from '../domain/ActivityError';
import type { ActivityItem, ApprovalStatus } from '../domain/Activity';

const dayMonth = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

/** "hoy" · "ayer" · "hace 3 días" · "5 oct" (calendar days, so daylight saving never skews it). */
export function formatWhen(date: Date, today: Date): string {
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((utc(today) - utc(date)) / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  return days < 7 ? `hace ${days} días` : dayMonth.format(date);
}

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

/**
 * One sentence per feed event. `nameOf` gives "Tú" for the signed-in person, so the verb has to
 * agree: "Tú añadiste…" / "Ana añadió…".
 */
export function describeActivity(item: ActivityItem, nameOf: (userId: string) => string): string {
  const actor = nameOf(item.actorId);
  const me = actor === 'Tú';
  const verb = (mine: string, theirs: string) => `${actor} ${me ? mine : theirs}`;
  const what = item.description ? `«${item.description}»` : 'un movimiento';

  switch (item.type) {
    case 'transaction-created':
      return `${verb('añadiste', 'añadió')} ${what}`;
    case 'transaction-updated':
      return `${verb('editaste', 'editó')} ${what}`;
    case 'transaction-deleted':
      return `${verb('eliminaste', 'eliminó')} ${what}`;
    case 'transaction-approved':
      return `${verb('aprobaste', 'aprobó')} ${what}`;
    case 'transaction-rejected':
      return `${verb('rechazaste', 'rechazó')} ${what}`;
    case 'comment-added':
      return `${verb('comentaste en', 'comentó en')} ${what}`;
    case 'settlement-created':
      return `${verb('registraste', 'registró')} un pago para saldar cuentas`;
    case 'member-joined':
      return `${actor} ${me ? 'te uniste' : 'se unió'} al hogar`;
    default:
      return `${actor} hizo un cambio en el hogar`;
  }
}

const messages: Record<ActivityErrorReason, string> = {
  'not-found': 'Ese movimiento ya no existe.',
  'already-decided': 'Otra persona ya ha decidido sobre este movimiento.',
  'cannot-approve-own': 'No puedes aprobar tus propios movimientos.',
  forbidden: 'No tienes permiso para hacer eso.',
  network: 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
  unknown: 'Algo ha salido mal. Inténtalo de nuevo.',
};

export function activityErrorMessage(error: unknown): string {
  return error instanceof ActivityError ? messages[error.reason] : messages.unknown;
}
