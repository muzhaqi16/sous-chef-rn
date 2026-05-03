import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from 'react-native-gesture-handler';
import { Text } from '#components/atoms/Text';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const Chip: React.FC<ChipProps> = ({ label, selected, onPress, style }) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
        style,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={
        selected
          ? `${label} filter selected, tap to deselect`
          : `${label} filter not selected, tap to select`
      }
      accessibilityState={{ selected }}
    >
      <Text
        size="sm"
        weight="semibold"
        style={selected ? styles.selectedText : styles.unselectedText}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  chip: {
    paddingVertical: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing['3'],
    borderRadius: theme.radii['2xl'],
    marginRight: theme.spacing.sm,
  },
  selected: {
    backgroundColor: theme.colors.chipSelectedBackground,
  },
  unselected: {
    backgroundColor: theme.colors.chipBackground,
  },
  selectedText: {
    color: theme.colors.chipSelectedText,
  },
  unselectedText: {
    color: theme.colors.chipText,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default Chip;
