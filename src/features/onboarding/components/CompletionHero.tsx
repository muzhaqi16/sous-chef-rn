import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from '#/i18n';
import { requirePlatform } from '#platform/install';
import { motion } from '#/theme/motion';
import { Text } from '#components/atoms/Text';
import { useAnimatedTheme } from '#hooks/ui/useAnimatedTheme';
import { useFirstName } from '#features/onboarding/hooks/useFirstName';
import { onboardingTestIDs } from '#features/onboarding/testIDs';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const SIZE = 88;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RADIUS;
const CHECK_PATH = 'M27 45 L39 57 L62 33';
// The two strokes' lengths, rounded up so no gap shows at the start.
const CHECK_LENGTH = 51;
// The ring draws, then the check, over two steps of the scale.
const DRAW_DURATION = motion.timing.SLOW * 2;

/**
 * The completion screen's opening: a check that draws itself, one success
 * haptic, and the user greeted by name. Reanimated finishes the drawing at
 * once under Reduce Motion, so the check is shown complete.
 */
export const CompletionHero = ({ subtitle }: { subtitle: string }) => {
  const { t } = useTranslation();
  const firstName = useFirstName();
  const animatedTheme = useAnimatedTheme();
  const drawn = useSharedValue(0);
  // A mount effect runs twice in development; the haptic is felt once.
  const celebratedRef = useRef(false);

  useEffect(() => {
    drawn.set(
      withTiming(1, {
        duration: DRAW_DURATION,
        easing: motion.easing.decelerate,
      }),
    );
    if (celebratedRef.current) return;
    celebratedRef.current = true;
    requirePlatform('haptics').success();
  }, [drawn]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(drawn.get(), [0, 0.6], [RING_LENGTH, 0], {
      extrapolateRight: 'clamp',
    }),
    stroke: animatedTheme.get().colors.primary,
  }));
  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(drawn.get(), [0.5, 1], [CHECK_LENGTH, 0], {
      extrapolateLeft: 'clamp',
    }),
    stroke: animatedTheme.get().colors.primary,
  }));

  return (
    <View style={styles.hero}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('onBoarding.setupComplete')}
        testID={onboardingTestIDs.completionCheck}
      >
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            // Starts at twelve o'clock and draws clockwise.
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            animatedProps={ringProps}
          />
          <AnimatedPath
            d={CHECK_PATH}
            strokeWidth={STROKE + 1}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={CHECK_LENGTH}
            animatedProps={checkProps}
          />
        </Svg>
      </View>
      <Text role="title" align="center" accessibilityRole="header">
        {firstName
          ? t('onBoarding.completeTitleNamed', { name: firstName })
          : t('onBoarding.completeTitle')}
      </Text>
      <Text role="body" tone="secondary" align="center">
        {subtitle}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  hero: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
}));
