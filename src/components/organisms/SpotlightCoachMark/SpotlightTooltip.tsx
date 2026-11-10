import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from '#components/atoms/themedComponents';
import { Button } from '#components/molecules/Button';
import { useAnimatedTheme } from '#hooks/ui/useAnimatedTheme';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { requirePlatform } from '#platform/install';
import { ARROW_SIZE } from './spotlightConstants';
import { kitTestIDs } from '#components/testIDs';

interface SpotlightTooltipProps {
  /** Absolute position ({left,top,width}) of the card. */
  containerStyle: StyleProp<ViewStyle>;
  /** Absolute position of the pointer arrow; none when the card cannot sit beside the target. */
  arrowStyle: StyleProp<ViewStyle> | null;
  /** Reanimated entry/cross-fade style for the card. */
  animatedStyle: React.ComponentProps<typeof Animated.View>['style'];
  onLayout: (event: LayoutChangeEvent) => void;
  title: string;
  subtitle?: string;
  stepIndex?: number;
  totalSteps?: number;
  /** The step continues on the user's action, so it has no Next. */
  waitsForAction?: boolean;
  /** The screen behind stays reachable, so the step is also spoken. */
  announce?: boolean;
  /** "End tour", or Got it on the last step. */
  onDismiss: () => void;
  /** "Not now": this tip closes and comes back later. */
  onClose: () => void;
  onNext?: () => void;
}

/**
 * The card a {@link SpotlightCoachMark} points from: "2 of 3", the tip, and
 * its actions — "Not now", "End tour" on a tour of several steps, and a filled
 * Next or Got it. The parent owns all geometry and animation. A screen reader
 * is taken to the tip's text, and its escape gesture is "Not now".
 */
export const SpotlightTooltip: React.FC<SpotlightTooltipProps> = ({
  containerStyle,
  arrowStyle,
  animatedStyle,
  onLayout,
  title,
  subtitle,
  stepIndex,
  totalSteps,
  waitsForAction = false,
  announce = false,
  onDismiss,
  onClose,
  onNext,
}) => {
  const { t } = useTranslation();
  const several = totalSteps != null && totalSteps > 1;
  const isLast =
    totalSteps == null || stepIndex == null || stepIndex >= totalSteps - 1;
  const progress =
    several && stepIndex != null
      ? t('tutorial.stepOf', { step: stepIndex + 1, total: totalSteps })
      : null;
  const spoken = [progress, title, subtitle].filter(Boolean).join('. ');

  const textRef = useRef<View>(null);
  useEffect(() => {
    const text = textRef.current;
    if (text) AccessibilityInfo.sendAccessibilityEvent(text, 'focus');
    if (announce) requirePlatform('screenReader').announce(spoken);
  }, [spoken, announce]);

  const animatedTheme = useAnimatedTheme();
  const surfaceStyle = useAnimatedStyle(() => {
    const theme = animatedTheme.get();
    return {
      padding: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
      ...theme.shadows.lg,
    };
  });

  const primary = waitsForAction
    ? null
    : isLast
    ? { label: t('tutorial.gotIt'), onPress: onDismiss }
    : onNext
    ? { label: t('labels.next'), onPress: onNext }
    : null;

  return (
    <View style={[styles.position, containerStyle]} onLayout={onLayout}>
      <Animated.View
        style={[styles.card, surfaceStyle, animatedStyle]}
        onAccessibilityEscape={onClose}
      >
        {arrowStyle ? <View style={[styles.arrow, arrowStyle]} /> : null}

        <View
          ref={textRef}
          accessible
          accessibilityRole="text"
          accessibilityLabel={spoken}
          style={styles.text}
        >
          {progress ? (
            <Text role="caption" tone="secondary">
              {progress}
            </Text>
          ) : null}
          <Text role="heading">{title}</Text>
          {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onClose}
            style={styles.textAction}
            accessibilityRole="button"
            testID={kitTestIDs.spotlightNotNowButton}
          >
            <Text role="bodyStrong" tone="secondary">
              {t('labels.notNow')}
            </Text>
          </Pressable>
          {/* Got it already ends the tour on its last step. */}
          {several && !isLast ? (
            <Pressable
              onPress={onDismiss}
              style={styles.textAction}
              accessibilityRole="button"
              testID={kitTestIDs.spotlightEndButton}
            >
              <Text role="bodyStrong" tone="secondary">
                {t('tutorial.endTour')}
              </Text>
            </Pressable>
          ) : null}
          {primary ? (
            <Button
              title={primary.label}
              onPress={primary.onPress}
              style={styles.primary}
              testID={kitTestIDs.spotlightPrimaryButton}
            />
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  position: {
    position: 'absolute',
  },
  // Themed surface values are in `surfaceStyle`.
  card: {
    borderCurve: 'continuous',
  },
  arrow: {
    position: 'absolute',
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    transform: [{ rotate: '45deg' }],
    backgroundColor: theme.colors.surface,
  },
  text: {
    gap: theme.spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  textAction: {
    minHeight: theme.sizes.touchTarget.min,
    minWidth: theme.sizes.touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  primary: {
    marginLeft: 'auto',
  },
}));
