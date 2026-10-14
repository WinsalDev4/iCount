import { pushDataSchema } from '@icount/contracts';

/**
 * The in-app route a tapped notification opens, or null. Only internal Expo
 * Router paths are accepted (ADR-0017): a push can never open an external URL,
 * including protocol-relative ones like `//evil.example`.
 */
export function routeFromNotificationData(data: unknown): string | null {
  const parsed = pushDataSchema.safeParse(data);
  if (!parsed.success) return null;
  const { url } = parsed.data;
  if (url.startsWith('//') || url.includes('\\') || /^\/[a-z][a-z0-9+.-]*:/i.test(url)) {
    return null;
  }
  return url;
}
