import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';

interface CalendarToggleBarProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export const CalendarToggleBar: React.FC<CalendarToggleBarProps> = ({
  isExpanded,
  onToggle,
}) => {
  const { theme } = useUnistyles();

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={{ top: 8, bottom: 8 }}
      style={styles.container}
      accessibilityLabel={
        isExpanded ? 'Collapse to week view' : 'Expand to month view'
      }
      accessibilityRole="button"
    >
      <View style={styles.line} />
      <Icon
        name={isExpanded ? 'chevron-up' : 'chevron-down'}
        size={16}
        color={theme.colors.textTertiary}
      />
      <View style={styles.line} />
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
    maxWidth: 80,
  },
}));
