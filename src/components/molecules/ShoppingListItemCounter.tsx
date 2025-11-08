import React from 'react';
import { View, Text } from 'react-native';
import { Counter } from './Counter';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

/**
 * Shopping List Item Counter
 *
 * Simplified counter that receives quantity as a prop.
 * Parent component manages data fetching and cache updates.
 *
 * Layout:
 * - Top row: Increment/Decrement buttons + rightElement (e.g., drag handle)
 * - Bottom row: Count + Unit text
 */
export const ShoppingListItemCounter = ({
  quantity,
  unit,
  onIncrement,
  onDecrement,
  rightElement,
}: {
  quantity: number;
  unit?: string | null;
  onIncrement: () => void;
  onDecrement: () => void;
  rightElement?: React.ReactNode;
}) => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      {/* Left Column: Counter + Unit Text (centered) */}
      <View style={styles.leftColumn}>
        <Counter
          count={quantity}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
        />
        {unit && (
          <Text
            style={[styles.unitText, { color: theme.colors.textSecondary }]}
          >
            {unit}
          </Text>
        )}
      </View>

      {/* Right Column: Drag Handle */}
      {rightElement && <View style={styles.rightColumn}>{rightElement}</View>}
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftColumn: {
    alignItems: 'center',
  },
  rightColumn: {
    justifyContent: 'center',
  },
  unitText: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
}));
