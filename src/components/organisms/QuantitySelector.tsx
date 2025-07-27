import React from 'react';
import {View} from 'react-native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import {Unit} from '../../graphql/generated';
import {Counter} from '../molecules/Counter';
import {Label} from '../atoms/Label';
import PickerSelect from '../atoms/Picker';

interface QuantitySelectorProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  unit: string;
  onUnitChange: (unit: string) => void;
  units?: Unit[];
}

const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  quantity,
  onIncrement,
  onDecrement,
  unit,
  onUnitChange,
  units,
}) => {
  const {styles} = useStyles(stylesheet);
  return (
    <View style={styles.container}>
      <View style={styles.selectors}>
        <Label>Select Quantity</Label>

        <Counter
          count={quantity}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
        />
      </View>

      <View style={styles.selectors}>
        <Label>Select Unit</Label>
        <View style={styles.pickerWrapper}>
          <PickerSelect
            initialValue={unit}
            onValueChange={onUnitChange}
            items={units}
            style={{
              backgroundColor: 'red',
            }}
          />
        </View>
      </View>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {marginTop: 12, flexDirection: 'row'},

  selectors: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    border: `1px solid ${theme.colors.border}`,
  },
  pickerWrapper: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
}));

export default QuantitySelector;
