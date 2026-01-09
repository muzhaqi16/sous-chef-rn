import React from 'react';
import { TouchableOpacity } from 'react-native';
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

  if (disabled) {
    return null;
  }

  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      delayLongPress={200}
      style={styles.container}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.6}
    >
      <Icon
        library="MaterialIcons"
        name="drag-indicator"
        size={24}
        color={color}
      />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create(() => ({
  container: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
