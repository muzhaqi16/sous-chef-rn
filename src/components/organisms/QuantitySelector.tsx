import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Unit } from '#/graphql/generated/schemaTypes';
import { Label } from '#components/atoms/Label';
import { PickerSelect } from '#components/atoms/Picker';
import { Counter } from '#components/molecules/Counter';

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
  units = [], // Provide default empty array
}) => {
  const { t } = useTranslation();
  // Transform units data for PickerSelect component
  const pickerItems = units.map(unitItem => ({
    label: `${unitItem.name} (${unitItem.symbol})`,
    value: unitItem.name,
    id: unitItem.id,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.selectors}>
        <Label>{t('quantitySelector.selectQuantity')}</Label>

        <Counter
          count={quantity}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
        />
      </View>

      <View style={styles.selectors}>
        <Label>{t('quantitySelector.selectUnit')}</Label>
        <View style={styles.pickerWrapper}>
          <PickerSelect
            initialValue={unit}
            onValueChange={onUnitChange}
            items={pickerItems} // Use transformed data
            style={{}}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
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
