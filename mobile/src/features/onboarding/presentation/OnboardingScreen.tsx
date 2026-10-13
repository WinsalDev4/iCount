import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Screen } from '@/shared/ui/Screen';
import { theme } from '@/shared/ui/theme';

import { stepFromOffset } from '../domain/stepNavigation';
import { useOnboardingViewModel, type StepUi } from './useOnboardingViewModel';

/** Page: the big figure in the middle, title and description below. */
function StepPage({
  step,
  index,
  width,
  scrollX,
}: {
  step: StepUi;
  index: number;
  width: number;
  scrollX: SharedValue<number>;
}) {
  // The figure shrinks and fades as its page slides away: a light parallax tied to the scroll.
  const figureStyle = useAnimatedStyle(() => {
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      opacity: interpolate(scrollX.value, input, [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(scrollX.value, input, [0.7, 1, 0.7], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View style={[styles.page, { width }]}>
      <Animated.View style={[styles.figureBox, figureStyle]}>
        <AppText variant="displayXxl" tone="accent" adjustsFontSizeToFit numberOfLines={1}>
          {step.figure}
        </AppText>
        <AppText tone="muted">{step.caption}</AppText>
      </Animated.View>
      <View style={styles.copy}>
        <AppText variant="displayL" style={styles.center}>
          {step.title}
        </AppText>
        <AppText tone="muted" style={styles.center}>
          {step.description}
        </AppText>
      </View>
    </View>
  );
}

/** Dot that stretches into a pill while its page is the current one. */
function Dot({
  index,
  width,
  scrollX,
}: {
  index: number;
  width: number;
  scrollX: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, input, [8, 24, 8], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, input, [0.35, 1, 0.35], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

/** View: draws the state and forwards events. Navigation = a redirect when completed. */
export function OnboardingScreen() {
  const { state, next, skip, goTo } = useOnboardingViewModel();
  const { width } = useWindowDimensions();
  const scrollX = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const stepIndex = state.status === 'active' ? state.stepIndex : 0;
  const total = state.status === 'active' ? state.steps.length : 0;

  // "Siguiente" changes the index in the ViewModel; bring the pager along.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: stepIndex * width, animated: true });
  }, [stepIndex, width, scrollRef]);

  if (state.status === 'completed') return <Redirect href="/" />;
  if (state.status === 'loading') return <Screen>{null}</Screen>;

  return (
    <Screen>
      <View style={styles.topBar}>
        {state.canSkip ? (
          <Button label="Saltar" variant="ghost" onPress={skip} style={styles.skip} />
        ) : null}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) =>
          goTo(stepFromOffset(event.nativeEvent.contentOffset.x, width, total))
        }
        style={styles.pager}
      >
        {state.steps.map((step, index) => (
          <StepPage key={step.id} step={step} index={index} width={width} scrollX={scrollX} />
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Paso"
          accessibilityValue={{ min: 1, max: total, now: stepIndex + 1 }}
          style={styles.dots}
        >
          {state.steps.map((step, index) => (
            <Dot key={step.id} index={index} width={width} scrollX={scrollX} />
          ))}
        </View>
        <Button label={state.primaryLabel} onPress={next} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: theme.minTouch + theme.spacing(2),
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing(4),
  },
  skip: { minHeight: theme.minTouch },
  pager: { flex: 1 },
  page: {
    flex: 1,
    paddingHorizontal: theme.spacing(6),
    justifyContent: 'center',
    gap: theme.spacing(10),
  },
  figureBox: { alignItems: 'center', gap: theme.spacing(2) },
  copy: { gap: theme.spacing(3) },
  center: { textAlign: 'center' },
  footer: { padding: theme.spacing(6), gap: theme.spacing(6) },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  dot: { height: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.accent },
});
