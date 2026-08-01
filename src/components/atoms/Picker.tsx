import { useState } from 'react';
import { ViewStyle } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { StyleSheet } from 'react-native-unistyles';

type PickerSelectProps = {
  items: { label: string; value: string; id: string }[];
  initialValue: string;
  onValueChange: (itemValue: string) => void;
  style: ViewStyle;
};

const Item = Picker.Item;

export const PickerSelect = ({
  items,
  initialValue,
  onValueChange,
  style,
}: PickerSelectProps) => {
  const [selectedValue] = useState(initialValue);

  return (
    <Picker
      selectedValue={selectedValue}
      onValueChange={onValueChange}
      style={[styles.picker, style]}
    >
      {items?.map(item => (
        <Item
          key={item.id}
          label={item.label}
          value={item.id}
          color={styles.item.color}
        />
      ))}
    </Picker>
  );
};

const styles = StyleSheet.create(theme => ({
  picker: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  item: {
    color: theme.colors.textPrimary,
  },
}));

export default PickerSelect;
