import {useState} from 'react';
import {ViewStyle} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

type PickerSelectProps = {
  items: {id: string; name: string}[] | undefined;
  initialValue: string;
  onValueChange: (itemValue: string) => void;
  style: ViewStyle;
};

const Item: any = Picker.Item;

export const PickerSelect = ({
  items,
  initialValue,
  onValueChange,
}: PickerSelectProps) => {
  const [selectedValue] = useState(initialValue);
  const {styles} = useStyles(stylesheet);

  return (
    <Picker selectedValue={selectedValue} onValueChange={onValueChange}>
      {items?.map(item => (
        <Item
          key={item.id}
          label={item.name}
          value={item.id}
          color={styles.item.color}
        />
      ))}
    </Picker>
  );
};

const stylesheet = createStyleSheet(theme => ({
  item: {
    color: theme.colors.textPrimary,
  },
}));

export default PickerSelect;
