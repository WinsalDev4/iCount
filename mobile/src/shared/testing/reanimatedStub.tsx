import { forwardRef, type ComponentProps } from 'react';
import { ScrollView, View } from 'react-native';

/**
 * Jest stand-in for `react-native-reanimated`.
 *
 * The real library needs its native worklets runtime, which does not exist under Jest, and the
 * official mock cannot be loaded without changing the Jest `resolver` in package.json (a hot
 * file). Use it per test file:
 *
 *   jest.mock('react-native-reanimated', () => require('@/shared/testing/reanimatedStub'));
 *
 * Only what our screens use is implemented; animated values are plain objects and the styles
 * are evaluated once, at their starting value. Animation itself is verified on a device.
 */
const AnimatedScrollView = forwardRef<ScrollView, ComponentProps<typeof ScrollView>>(
  function AnimatedScrollView(props, ref) {
    return <ScrollView ref={ref} {...props} />;
  },
);

export const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' } as const;

/** Returns the output at the first input stop, i.e. the "page not scrolled yet" state. */
export function interpolate(_value: number, _input: readonly number[], output: readonly number[]) {
  return output[0] ?? 0;
}

export function useSharedValue<T>(initial: T) {
  return { value: initial };
}

export function useAnimatedStyle<T>(factory: () => T): T {
  return factory();
}

export function useAnimatedScrollHandler() {
  return () => undefined;
}

export function useAnimatedRef() {
  return { current: null };
}

export type SharedValue<T> = { value: T };

export default { View, ScrollView: AnimatedScrollView };
