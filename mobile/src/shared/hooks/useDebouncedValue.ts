import { useEffect, useState } from 'react';

/**
 * `value`, but only after it stopped changing for `delayMs`: a search box can type freely while
 * the (expensive) query waits for a pause. The first value is available immediately.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
