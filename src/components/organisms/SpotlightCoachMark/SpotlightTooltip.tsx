import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { useAnimatedTheme } from '#hooks/ui/useAnimatedTheme';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { ARROW_SIZE } from './spotlightConstants';
import { hitSlop } from '#/theme/foundations/sizes';
import { kitTestIDs } from '#components/testIDs';

interface SpotlightTooltipProps {
  /** Absolute position ({left,width,top|bottom}) of the tooltip card. */
  containerStyle: StyleProp<ViewStyle>;
  /** Absolute position ({left,top|bottom}) of the pointer arrow. */
  arrowStyle: StyleProp<ViewStyle>;
  /** Reanimated entry/cross-fade style for the card. */
  animatedStyle: React.ComponentProps<typeof Animated.View>['style'];
  title: string;
  subtitle?: string;
  stepIndex?: number;
  totalSteps?: number;
  onDismiss: () => void;
  onNext?: () => void;
}

/**
 * Tooltip card rendered by {@link SpotlightCoachMark}: title/subtitle, step
 * dots, and its actions: Skip on the left, Next or Done on the right. Skip
 * lives here, not over the screen, because the parent already keeps the card
 * clear of the hole and on screen, and a floating one landed on header buttons.
 * Purely presentational — the parent owns all geometry and animation.
 */
export const SpotlightTooltip: React.FC<SpotlightTooltipProps> = ({
  containerStyle,
  arrowStyle,
  animatedStyle,
  title,
  subtitle,
  stepIndex,
  totalSteps,
  onDismiss,
  onNext,
}) => {
  const { t } = useTranslation();
  const isLast =
    totalSteps != null && stepIndex != null && stepIndex >= totalSteps - 1;

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

  return (
    <Animated.View
      style={[styles.tooltip, containerStyle, surfaceStyle, animatedStyle]}
    >
      {/* Arrow */}
      <View style={[styles.arrow, arrowStyle]} />

      <Text role="heading" style={styles.tooltipTitle}>
        {title}
      </Text>
      {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
      {totalSteps != null && stepIndex != null && totalSteps > 1 ? (
        <View style={styles.stepIndicator}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <View key={i} style={styles.stepDot(i === stepIndex)} />
          ))}
        </View>
      ) : null}
      <View style={styles.actions}>
        {/* Done already ends the tutorial; a Skip beside it would repeat it. */}
        {isLast ? null : (
          <Pressable
            onPress={onDismiss}
            style={styles.actionButton}
            hitSlop={hitSlop.md}
            accessibilityRole="button"
            accessibilityHint={t('tutorial.skipTutorial')}
            testID={kitTestIDs.spotlightSkipButton}
          >
            <Text role="bodyStrong" tone="secondary">
              {totalSteps != null && totalSteps > 1
                ? t('labels.skipAll')
                : t('labels.skip')}
            </Text>
          </Pressable>
        )}
        {isLast ? (
          <Pressable
            onPress={onDismiss}
            style={styles.trailingAction}
            hitSlop={hitSlop.md}
          >
            <Text role="bodyStrong" tone="accent">
              {t('labels.done')}
            </Text>
          </Pressable>
        ) : onNext ? (
          <Pressable
            onPress={onNext}
            style={styles.trailingAction}
            hitSlop={hitSlop.md}
          >
            <Text role="bodyStrong" tone="accent">
              {t('labels.next')} ›
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  // Themed surface values are in `surfaceStyle`.
  tooltip: {
    position: 'absolute',
    borderCurve: 'continuous',
  },
  arrow: {
    position: 'absolute',
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    transform: [{ rotate: '45deg' }],
    backgroundColor: theme.colors.surface,
  },
  tooltipTitle: {
    marginBottom: theme.spacing.xs,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  stepDot: (active: boolean) => ({
    width: 8,
    height: 8,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: active ? theme.colors.primary : theme.colors.border,
  }),
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  actionButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  trailingAction: {
    marginLeft: 'auto',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
}));
