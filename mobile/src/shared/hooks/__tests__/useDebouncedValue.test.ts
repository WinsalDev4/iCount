import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedValue } from '../useDebouncedValue';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useDebouncedValue', () => {
  it('has the first value right away', async () => {
    const { result } = await renderHook(() => useDebouncedValue('a', 300));
    expect(result.current).toBe('a');
  });

  it('waits for a pause before following the value', async () => {
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 300),
      {
        initialProps: { value: 'a' },
      },
    );
    await rerender({ value: 'ab' });
    await act(async () => jest.advanceTimersByTimeAsync(299));
    expect(result.current).toBe('a');
    await act(async () => jest.advanceTimersByTimeAsync(1));
    expect(result.current).toBe('ab');
  });

  it('keeps restarting the wait while the value keeps changing', async () => {
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 300),
      {
        initialProps: { value: 'a' },
      },
    );
    for (const next of ['ab', 'abc', 'abcd']) {
      await rerender({ value: next });
      await act(async () => jest.advanceTimersByTimeAsync(200));
    }
    expect(result.current).toBe('a'); // never paused long enough
    await act(async () => jest.advanceTimersByTimeAsync(300));
    expect(result.current).toBe('abcd');
  });

  it('uses 300 ms by default', async () => {
    const { result, rerender } = await renderHook(
      ({ value }: { value: number }) => useDebouncedValue(value),
      {
        initialProps: { value: 1 },
      },
    );
    await rerender({ value: 2 });
    await act(async () => jest.advanceTimersByTimeAsync(300));
    expect(result.current).toBe(2);
  });
});
