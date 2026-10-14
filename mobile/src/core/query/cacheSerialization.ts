import { type CurrencyCode, Money } from '@/core/domain/Money';

/**
 * JSON for the persisted query cache that keeps the domain types alive. The cache
 * holds domain objects (repositories map DTOs at the boundary), and plain JSON
 * would bring them back without their methods: a `Money` without `format()`, a
 * `Date` as a string, a `Map` as `{}`. Each one is written as a tagged object and
 * revived on read. Android analogy: a custom Moshi/Gson adapter for your value types.
 */
const TAG = '__icount';

type Tagged =
  | { [TAG]: 'Money'; amountMinor: number; currency: CurrencyCode }
  | { [TAG]: 'Date'; iso: string }
  | { [TAG]: 'Map'; entries: [unknown, unknown][] };

function replacer(this: Record<string, unknown>, key: string, value: unknown): unknown {
  // `Date#toJSON` runs before the replacer sees the value: read the original from the holder.
  const original = this[key];
  if (original instanceof Date) return { [TAG]: 'Date', iso: original.toISOString() };
  if (original instanceof Money) {
    return { [TAG]: 'Money', amountMinor: original.amountMinor, currency: original.currency };
  }
  if (original instanceof Map) return { [TAG]: 'Map', entries: [...original.entries()] };
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (typeof value !== 'object' || value === null || !(TAG in value)) return value;
  const tagged = value as Tagged;
  switch (tagged[TAG]) {
    case 'Money':
      return Money.ofMinor(tagged.amountMinor, tagged.currency);
    case 'Date':
      return new Date(tagged.iso);
    case 'Map':
      return new Map(tagged.entries);
    default:
      return value;
  }
}

export function serializeCache(value: unknown): string {
  return JSON.stringify(value, replacer);
}

export function deserializeCache<T>(text: string): T {
  return JSON.parse(text, reviver) as T;
}
