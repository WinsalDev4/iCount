import { z } from 'zod';

import type { ListCursor } from '../domain/transaction-repository.js';
import { InvalidCursorError } from '../domain/transaction.js';

const cursorSchema = z.object({
  o: z.iso.date(),
  c: z.iso.datetime(),
  i: z.uuid(),
});

/**
 * Opaque cursor = base64url(JSON) of the last item's sort key. Clients only pass
 * it back; the server can change its format at any time.
 */
export function encodeCursor(cursor: ListCursor): string {
  const payload = { o: cursor.occurredOn, c: cursor.createdAt.toISOString(), i: cursor.id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(value: string): ListCursor {
  try {
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
    return { occurredOn: parsed.o, createdAt: new Date(parsed.c), id: parsed.i };
  } catch {
    throw new InvalidCursorError();
  }
}
