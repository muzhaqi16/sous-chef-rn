// src/atoms/Chip.tsx
import React from 'react';
import {TouchableOpacity, Text, StyleProp, ViewStyle} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const stylesheet = createStyleSheet(theme => ({
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
    color: theme.colors.white,
  },
  unselectedText: {
    color: theme.colors.chipText,
  },
}));

const Chip: React.FC<ChipProps> = ({label, selected, onPress, style}) => {
  const {styles} = useStyles(stylesheet);
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        selected ? styles.selected : styles.unselected,
        style,
      ]}
      onPress={onPress}>
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

export default Chip;
