import React from 'react';
import {View} from 'react-native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import {Unit} from '../../graphql/generated';
import {Label, PickerSelect, Counter} from '..';

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
            style={{}}
          />
        </View>
      </View>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    marginTop: theme.spacing.xs,
    flexDirection: 'row',
  },
  selectors: {
    flex: 1,
    justifyContent: 'space-between',
  },
  pickerWrapper: {
    height: 30,
    justifyContent: 'center',
    overflow: 'hidden',
  },
}));

export default QuantitySelector;
