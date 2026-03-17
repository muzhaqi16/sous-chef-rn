import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';

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
  const { theme } = useUnistyles();

  if (variant === 'handle') {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={styles.handleContainer}
      >
        <Icon name="chevron-down" size={20} color={theme.colors.primary} />
        <Text style={styles.handleText}>{text}</Text>
        {!!onSkip && (
          <Pressable onPress={onSkip} hitSlop={8} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
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
          <Icon name="hand-left-outline" size={16} color={theme.colors.white} />
        </View>
        <Text style={styles.inlineText}>{text}</Text>
      </View>
      {!!onSkip && (
        <Pressable onPress={onSkip} hitSlop={8} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
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
  handleText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.primary,
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
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    flex: 1,
  },

  // ── Shared ──
  skipButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  skipText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textTertiary,
  },
}));
