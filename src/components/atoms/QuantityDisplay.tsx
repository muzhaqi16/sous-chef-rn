import React from 'react';
import type { TextStyle, StyleProp } from 'react-native';
import { Text } from '#components/atoms/Text';
import type { DisplayFormat } from '#/graphql/generated/schemaTypes';
import {
  formatQuantityForDisplay,
  resolveQuantityNotation,
  unitLabel,
  type UnitLabelSource,
} from '#/utils/formatQuantity';

interface QuantityDisplayProps {
  quantity: number | null | undefined;
  quantityInput?: string | null;
  displayFormat?: DisplayFormat | null;
  unit?: UnitLabelSource | null;
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
  unit,
  displayAsFraction,
  style,
  showUnit = true,
}) => {
  const notation = resolveQuantityNotation(displayFormat, displayAsFraction);
  const text = formatQuantityForDisplay(quantity, { quantityInput, notation });

  if (!text) return <Text style={style}>-</Text>;
  const label = showUnit ? unitLabel(unit, { quantity, notation }) : '';

  return (
    <Text style={style}>
      {text}
      {label ? ` ${label}` : ''}
    </Text>
  );
};
