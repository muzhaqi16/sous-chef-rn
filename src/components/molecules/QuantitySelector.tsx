import React from 'react';
import {View, Text} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import IconButton from '../atoms/IconButton';

type QuantitySelectorProps = {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary || '#000',
    marginHorizontal: 8,
    minWidth: 20,
    textAlign: 'center',
  },
}));

const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  quantity,
  onIncrement,
  onDecrement,
}) => {
  const {styles} = useStyles(stylesheet);
  return (
    <View style={styles.container}>
      <IconButton
        name="remove-circle-outline"
        onPress={onDecrement}
        size={24}
      />
      <Text style={styles.quantityText}>{quantity}</Text>
      <IconButton name="add-circle-outline" onPress={onIncrement} size={24} />
    </View>
  );
};

export default QuantitySelector;
