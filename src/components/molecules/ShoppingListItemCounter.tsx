import React from 'react';
import { View, Text } from 'react-native';
import { Counter } from './Counter';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

/**
 * Shopping List Item Counter
 *
 * Simplified counter that receives quantity as a prop.
 * Parent component manages data fetching and cache updates.
 * This matches the pantry implementation pattern.
 */
export const ShoppingListItemCounter = ({
  quantity,
  unit,
  onIncrement,
  onDecrement,
}: {
  quantity: number;
  unit?: string | null;
  onIncrement: () => void;
  onDecrement: () => void;
}) => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      <Counter
        count={quantity}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
      />
      {unit && (
        <Text style={[styles.unitText, { color: theme.colors.textSecondary }]}>
          {unit}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitText: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
}));
