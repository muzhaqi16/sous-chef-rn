import React from 'react';
import { TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#/utils';

interface DragHandleProps {
  onLongPress: () => void;
  disabled?: boolean;
}

/**
 * Drag handle component for reordering list items.
 * Shows a drag indicator icon that activates drag-to-reorder on long-press.
 */
export const DragHandle: React.FC<DragHandleProps> = ({
  onLongPress,
  disabled = false,
}) => {
  const { theme } = useUnistyles();

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
        color={theme.colors.textSecondary}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
