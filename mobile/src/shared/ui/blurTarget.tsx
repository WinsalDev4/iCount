import { createContext, useContext, type RefObject } from 'react';
import type { View } from 'react-native';

/**
 * On Android, expo-blur only blurs what lives inside a `BlurTargetView`.
 * `Screen` wraps its background in one and shares the ref here so that any
 * `GlassCard` below can point its `BlurView` at it.
 */
export const BlurTargetContext = createContext<RefObject<View | null> | null>(null);

export function useBlurTarget() {
  return useContext(BlurTargetContext);
}
