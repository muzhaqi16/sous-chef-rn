import React from 'react';
import {TouchableOpacity, Text, StyleProp, ViewStyle} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const Chip: React.FC<ChipProps> = ({label, selected, onPress, style}) => {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        selected ? styles.selected : styles.unselected,
        style,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={selected ? `${label} filter selected, tap to deselect` : `${label} filter not selected, tap to select`}
      accessibilityState={{selected}}>
      <Text
        style={[
          styles.chipText,
          selected ? styles.selectedText : styles.unselectedText,
        ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
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
}));

export default Chip;
