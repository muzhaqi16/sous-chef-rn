import React from 'react';
import { TextStyle, StyleProp } from 'react-native';
import { Text } from '#components/atoms/Text';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';

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
 * Renders a quantity, preferring the user's own `quantityInput` verbatim, then
 * `displayFormat`, then the `displayAsFraction` setting, then 2-place decimal.
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
  // Before any conditional return, per the Rules of Hooks.
  const formattedQuantity = (() => {
    if (quantityInput) {
      return null;
    }

    if (quantity === null || quantity === undefined) {
      return null;
    }

    switch (displayFormat) {
      case DisplayFormat.Fraction:
        return decimalToFraction(quantity);
      case DisplayFormat.Mixed:
        return decimalToMixed(quantity);
      case DisplayFormat.Decimal:
        return formatDecimal(quantity);
      case DisplayFormat.Auto:
      default:
        if (displayAsFraction && shouldUseFraction(quantity)) {
          return decimalToMixed(quantity);
        }
        return formatDecimal(quantity);
    }
  })();

  if (quantityInput) {
    return (
      <Text style={style}>
        {quantityInput}
        {showUnit && unitSymbol ? ` ${unitSymbol}` : ''}
      </Text>
    );
  }

  if (formattedQuantity === null) {
    return <Text style={style}>-</Text>;
  }

  return (
    <Text style={style}>
      {formattedQuantity}
      {showUnit && unitSymbol ? ` ${unitSymbol}` : ''}
    </Text>
  );
};

/** 0.75 → "3/4". */
function decimalToFraction(decimal: number): string {
  if (decimal === 0) return '0';
  if (Number.isInteger(decimal)) return decimal.toString();

  const fractions: Record<string, string> = {
    '0.125': '1/8',
    '0.25': '1/4',
    '0.333': '1/3',
    '0.375': '3/8',
    '0.5': '1/2',
    '0.625': '5/8',
    '0.667': '2/3',
    '0.75': '3/4',
    '0.875': '7/8',
  };

  const rounded = decimal.toFixed(3);
  if (fractions[rounded]) {
    return fractions[rounded];
  }

  const tolerance = 0.01;
  for (let denominator = 2; denominator <= 16; denominator++) {
    for (let numerator = 1; numerator < denominator; numerator++) {
      if (Math.abs(decimal - numerator / denominator) < tolerance) {
        return `${numerator}/${denominator}`;
      }
    }
  }

  return formatDecimal(decimal);
}

/** 1.5 → "1 1/2". */
function decimalToMixed(decimal: number): string {
  if (decimal === 0) return '0';
  if (Number.isInteger(decimal)) return decimal.toString();

  const whole = Math.floor(decimal);
  const fractional = decimal - whole;

  if (fractional === 0) {
    return whole.toString();
  }

  const fractionPart = decimalToFraction(fractional);

  if (fractionPart.includes('.')) {
    return formatDecimal(decimal);
  }

  if (whole === 0) {
    return fractionPart;
  }

  return `${whole} ${fractionPart}`;
}

function formatDecimal(decimal: number): string {
  const formatted = decimal.toFixed(2).replace(/\.?0+$/, '');
  return formatted || '0';
}

function shouldUseFraction(decimal: number): boolean {
  if (decimal >= 10) return false;

  const fractional = decimal - Math.floor(decimal);
  if (fractional === 0) return false;

  const commonFractions = [
    0.125, 0.25, 0.333, 0.375, 0.5, 0.625, 0.667, 0.75, 0.875,
  ];
  const tolerance = 0.01;

  return commonFractions.some(frac => Math.abs(fractional - frac) < tolerance);
}
