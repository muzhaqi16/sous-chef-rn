import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';

interface DragHandleProps {
  onLongPress: () => void;
  disabled?: boolean;
  /** PERFORMANCE: Pass icon color from parent to avoid useUnistyles call */
  iconColor?: string;
}

/**
 * Drag handle component for reordering list items.
 * Shows a drag indicator icon that activates drag-to-reorder on long-press.
 * Uses RNGH LongPress gesture for better coordination with pan gestures.
 * Memoized to prevent unnecessary re-renders when parent re-renders.
 */
export function DragHandle({
  onLongPress,
  disabled = false,
  iconColor,
}: DragHandleProps) {
  // Always call useUnistyles to satisfy Rules of Hooks
  // But when iconColor is provided, the theme lookup is not used (minor overhead only)
  const { theme } = useUnistyles();
  // PERFORMANCE: Use passed iconColor to avoid re-render when theme unchanged
  const color = iconColor ?? theme.colors.textSecondary;

  // Stabilize callback reference for consistent gesture behavior
  const handleLongPress = useCallback(() => {
    onLongPress();
  }, [onLongPress]);

  // RNGH LongPress gesture for better coordination with pan gesture in SortableList
  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .enabled(!disabled)
        .minDuration(200)
        .onStart(() => {
          'worklet';
          scheduleOnRN(handleLongPress);
        }),
    [disabled, handleLongPress],
  );

  if (disabled) {
    return null;
  }

  return (
    <GestureDetector gesture={longPressGesture}>
      <View style={styles.container}>
        <Icon
          name="reorder-three"
          size={24}
          color={color}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    // Padding provides larger touch target (replaces hitSlop from TouchableOpacity)
    paddingVertical: theme.spacing['2.5'],
    paddingHorizontal: theme.spacing['2.5'],
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
