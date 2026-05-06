import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

interface SheetTutorialHintProps {
  /** The hint text displayed to the user */
  text: string;
  /** 'inline' = banner in content flow, 'handle' = floating near drag handle */
  variant: 'inline' | 'handle';
  /** Called when the skip/dismiss button is pressed */
  onSkip?: () => void;
}

/**
 * Lightweight hint component rendered inside a BottomSheetModal.
 * Avoids the Modal-on-Modal conflict that SpotlightCoachMark would cause.
 *
 * Two variants:
 * - `inline`:  Banner with icon + text, rendered in the sheet's content flow
 *              (e.g. above suggestion items: "Tap + next to an item to add it")
 * - `handle`:  Floating indicator near the sheet handle with animated down-arrow
 *              (e.g. "Pull down to close")
 */
export const SheetTutorialHint: React.FC<SheetTutorialHintProps> = ({
  text,
  variant,
  onSkip,
}) => {
  if (variant === 'handle') {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={styles.handleContainer}
      >
        <Icon name="chevron-down" size={20} tone="primary" />
        <Text size="sm" weight="medium" tone="accent">
          {text}
        </Text>
        {!!onSkip && (
          <Pressable onPress={onSkip} hitSlop={8} style={styles.skipButton}>
            <Text size="sm" weight="medium" tone="tertiary">
              Skip
            </Text>
          </Pressable>
        )}
      </Animated.View>
    );
  }

  // inline variant
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={styles.inlineContainer}
    >
      <View style={styles.inlineContent}>
        <View style={styles.iconCircle}>
          <Icon name="hand-left-outline" size={16} tone="white" />
        </View>
        <Text size="sm" weight="medium" style={styles.inlineText}>
          {text}
        </Text>
      </View>
      {!!onSkip && (
        <Pressable onPress={onSkip} hitSlop={8} style={styles.skipButton}>
          <Text size="sm" weight="medium" tone="tertiary">
            Skip
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  // ── Handle variant ──
  handleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  // ── Inline variant ──
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.primary + '1A', // 10% opacity
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  inlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineText: {
    flex: 1,
  },

  // ── Shared ──
  skipButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
}));
