/**
 * Placeholder for a port whose implementation arrives in a later task (X.0 stubs).
 * Creating it never fails, so the container still builds and the app starts;
 * calling any method rejects with a clear message instead.
 */
export function notImplemented<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get(_target, property) {
      // Not a thenable and not inspectable: `await stub` or logging it must not call the trap.
      if (typeof property === 'symbol' || property === 'then') return undefined;
      return () => Promise.reject(new Error(`${name}.${property}() is not implemented yet`));
    },
  });
}
