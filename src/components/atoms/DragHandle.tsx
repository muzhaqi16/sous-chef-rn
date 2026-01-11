import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#/utils';

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
export const DragHandle = React.memo(function DragHandle({
  onLongPress,
  disabled = false,
  iconColor,
}: DragHandleProps) {
  // Always call useUnistyles to satisfy Rules of Hooks
  // But when iconColor is provided, the theme lookup is not used (minor overhead only)
  const { theme } = useUnistyles();
  // PERFORMANCE: Use passed iconColor to avoid re-render when theme unchanged
  const color = iconColor ?? theme.colors.textSecondary;

  // RNGH LongPress gesture for better coordination with pan gesture in SortableList
  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .enabled(!disabled)
        .minDuration(200)
        .onStart(() => {
          'worklet';
          runOnJS(onLongPress)();
        }),
    [disabled, onLongPress],
  );

  if (disabled) {
    return null;
  }

  return (
    <GestureDetector gesture={longPressGesture}>
      <View style={styles.container}>
        <Icon
          library="MaterialIcons"
          name="drag-indicator"
          size={24}
          color={color}
        />
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create(() => ({
  container: {
    // Padding provides larger touch target (replaces hitSlop from TouchableOpacity)
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
