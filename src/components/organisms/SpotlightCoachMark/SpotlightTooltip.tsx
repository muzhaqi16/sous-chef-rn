import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { ARROW_SIZE } from './spotlightConstants';

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
 * dots, and the Done/Next action. Purely presentational — the parent owns all
 * geometry and animation and passes computed position/animated styles in.
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
  const { theme } = useUnistyles();

  return (
    <Animated.View style={[styles.tooltip, containerStyle, animatedStyle]}>
      {/* Arrow */}
      <View
        style={[
          styles.arrow,
          { backgroundColor: theme.colors.surface },
          arrowStyle,
        ]}
      />

      <Text size="lg" weight="bold" style={styles.tooltipTitle}>
        {title}
      </Text>
      {subtitle ? (
        <Text size="md" tone="secondary">
          {subtitle}
        </Text>
      ) : null}
      {totalSteps != null && stepIndex != null && totalSteps > 1 ? (
        <View style={styles.stepIndicator}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                {
                  backgroundColor:
                    i === stepIndex
                      ? theme.colors.primary
                      : theme.colors.border,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
      {totalSteps != null &&
      stepIndex != null &&
      stepIndex >= totalSteps - 1 ? (
        <Pressable onPress={onDismiss} style={styles.nextButton} hitSlop={8}>
          <Text size="md" weight="medium" tone="accent">
            {t('labels.done')}
          </Text>
        </Pressable>
      ) : onNext ? (
        <Pressable onPress={onNext} style={styles.nextButton} hitSlop={8}>
          <Text size="md" weight="medium" tone="accent">
            {t('labels.next')} ›
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  tooltip: {
    position: 'absolute',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 4,
        blurRadius: 12,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.3)',
      },
    ],
  },
  arrow: {
    position: 'absolute',
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    transform: [{ rotate: '45deg' }],
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
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
  },
  nextButton: {
    alignSelf: 'flex-end',
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
}));
