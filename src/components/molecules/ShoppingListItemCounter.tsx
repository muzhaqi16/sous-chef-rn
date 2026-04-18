import React from 'react';
import { View } from 'react-native';
import { Counter } from './Counter';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

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
  disabled = false,
}: {
  quantity: number;
  unit?: string | null;
  onIncrement: () => void;
  onDecrement: () => void;
  rightElement?: React.ReactNode;
  disabled?: boolean;
}) => {
  return (
    <View style={styles.container}>
      {/* Left Column: Counter + Unit Text (centered) */}
      <View style={styles.leftColumn}>
        <Counter
          count={quantity}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          disabled={disabled}
        />
        {!!unit && (
          <Text align="center" tone="secondary" style={styles.unitText}>
            {unit}
          </Text>
        )}
      </View>

      {/* Right Column: Drag Handle */}
      {!!rightElement && <View style={styles.rightColumn}>{rightElement}</View>}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
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
    fontSize: theme.typography.fontSize.xs - 1,
    marginTop: theme.spacing.xs,
  },
}));
