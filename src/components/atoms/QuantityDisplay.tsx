import React from 'react';
import { TextStyle, StyleProp } from 'react-native';
import { Text } from '#components/atoms/Text';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import {
  formatQuantityForDisplay,
  type QuantityNotation,
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
 * Renders a quantity through `formatQuantityForDisplay`, with the item's
 * `displayFormat` — then the unit's `displayAsFraction` — choosing the
 * notation. Absent both, a cooking fraction wins over a decimal.
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
    notation: resolveNotation(displayFormat, displayAsFraction),
  });

  if (!text) return <Text style={style}>-</Text>;

  return (
    <Text style={style}>
      {text}
      {showUnit && unitSymbol ? ` ${unitSymbol}` : ''}
    </Text>
  );
};

function resolveNotation(
  displayFormat: DisplayFormat | null | undefined,
  displayAsFraction: boolean | null | undefined,
): QuantityNotation {
  switch (displayFormat) {
    case DisplayFormat.Fraction:
      return 'fraction';
    case DisplayFormat.Mixed:
      return 'mixed';
    case DisplayFormat.Decimal:
      return 'decimal';
    default:
      // Only an explicit `false` — a unit nobody halves — opts out of fractions.
      return displayAsFraction === false ? 'decimal' : 'mixed';
  }
}
