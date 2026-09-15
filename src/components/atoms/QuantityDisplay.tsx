import React from 'react';
import type { TextStyle, StyleProp } from 'react-native';
import { Text } from '#components/atoms/Text';
import type { DisplayFormat } from '#/graphql/generated/schemaTypes';
import {
  formatQuantityForDisplay,
  resolveQuantityNotation,
} from '#/utils/formatQuantity';

interface QuantityDisplayProps {
  quantity: number | null | undefined;
  quantityInput?: string | null;
  displayFormat?: DisplayFormat | null;
  unitSymbol?: string | null;
  displayAsFraction?: boolean | null;
  style?: StyleProp<TextStyle>;
  showUnit?: boolean;
}

/**
 * Renders a quantity through `formatQuantityForDisplay`, in the notation
 * {@link resolveQuantityNotation} picks from the item and its unit.
 */
export const QuantityDisplay: React.FC<QuantityDisplayProps> = ({
  quantity,
  quantityInput,
  displayFormat,
  unitSymbol,
  displayAsFraction,
  style,
  showUnit = true,
}) => {
  const text = formatQuantityForDisplay(quantity, {
    quantityInput,
    notation: resolveQuantityNotation(displayFormat, displayAsFraction),
  });

  if (!text) return <Text style={style}>-</Text>;

  return (
    <Text style={style}>
      {text}
      {showUnit && unitSymbol ? ` ${unitSymbol}` : ''}
    </Text>
  );
};
