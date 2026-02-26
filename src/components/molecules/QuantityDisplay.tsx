import React from 'react';
import {Text, TextStyle, StyleProp} from 'react-native';
import {DisplayFormat} from '#/graphql/generated';

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
 * QuantityDisplay component for rendering quantities with smart formatting
 *
 * Priority:
 * 1. Use quantityInput if available (preserves exact user input)
 * 2. Format based on displayFormat preference
 * 3. Fall back to displayAsFraction setting
 * 4. Default to decimal with 2 precision
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
  // Memoize the expensive fraction conversion to avoid O(n²) loop on every render
  // Must be called before any conditional returns to follow Rules of Hooks
  const formattedQuantity = (() => {
    // If we have the original user input, we'll use it instead (handled below)
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

  // If we have the original user input, use it (preserves fractions)
  if (quantityInput) {
    return (
      <Text style={style}>
        {quantityInput}
        {showUnit && unitSymbol ? ` ${unitSymbol}` : ''}
      </Text>
    );
  }

  // No quantity to display
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

/**
 * Convert decimal to simple fraction (e.g., 0.75 → "3/4")
 */
function decimalToFraction(decimal: number): string {
  if (decimal === 0) return '0';
  if (Number.isInteger(decimal)) return decimal.toString();

  // Common fractions
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

  // Try to find a simple fraction
  const tolerance = 0.01;
  for (let denominator = 2; denominator <= 16; denominator++) {
    for (let numerator = 1; numerator < denominator; numerator++) {
      if (Math.abs(decimal - numerator / denominator) < tolerance) {
        return `${numerator}/${denominator}`;
      }
    }
  }

  // Fall back to decimal
  return formatDecimal(decimal);
}

/**
 * Convert decimal to mixed number (e.g., 1.5 → "1 1/2")
 */
function decimalToMixed(decimal: number): string {
  if (decimal === 0) return '0';
  if (Number.isInteger(decimal)) return decimal.toString();

  const whole = Math.floor(decimal);
  const fractional = decimal - whole;

  if (fractional === 0) {
    return whole.toString();
  }

  const fractionPart = decimalToFraction(fractional);

  // If conversion to fraction failed, use decimal
  if (fractionPart.includes('.')) {
    return formatDecimal(decimal);
  }

  if (whole === 0) {
    return fractionPart;
  }

  return `${whole} ${fractionPart}`;
}

/**
 * Format as decimal with smart precision
 */
function formatDecimal(decimal: number): string {
  // Remove trailing zeros
  const formatted = decimal.toFixed(2).replace(/\.?0+$/, '');
  return formatted || '0';
}

/**
 * Determine if a decimal should be displayed as a fraction
 */
function shouldUseFraction(decimal: number): boolean {
  // Only use fractions for common values under 10
  if (decimal >= 10) return false;

  const fractional = decimal - Math.floor(decimal);
  if (fractional === 0) return false;

  // Check if it's close to a common fraction
  const commonFractions = [0.125, 0.25, 0.333, 0.375, 0.5, 0.625, 0.667, 0.75, 0.875];
  const tolerance = 0.01;

  return commonFractions.some(
    frac => Math.abs(fractional - frac) < tolerance
  );
}
