import React from 'react';
import { Counter } from './Counter';

/**
 * Shopping List Item Counter
 *
 * Simplified counter that receives quantity as a prop.
 * Parent component manages data fetching and cache updates.
 * This matches the pantry implementation pattern.
 */
export const ShoppingListItemCounter = ({
  quantity,
  onIncrement,
  onDecrement,
}: {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) => {

  return (
    <Counter
      count={quantity}
      onIncrement={onIncrement}
      onDecrement={onDecrement}
    />
  );
};
