import React from 'react';
import { Text, View } from 'react-native';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { QuantityDisplay } from '#/components/molecules/QuantityDisplay';
import { DisplayFormat } from '#/graphql/generated';

interface FormattedItemSubtitleProps {
  quantity?: number | null;
  quantityInput?: string | null;
  displayFormat?: DisplayFormat | null;
  displayAsFraction?: boolean | null;
  netWeight?: number | null;
  unitSymbol?: string | null;
  additionalInfo?: string; // For storage state, category, etc.
}

/**
 * Formats item quantity and weight with separate colors
 * Example: "2 × 3.2 oz" where 2 is primary color and 3.2 oz is secondary
 */
export const FormattedItemSubtitle: React.FC<FormattedItemSubtitleProps> = ({
  quantity,
  quantityInput,
  displayFormat,
  displayAsFraction,
  netWeight,
  unitSymbol,
  additionalInfo,
}) => {
  const { theme } = useUnistyles();

  // Handle edge cases
  const hasQuantity = quantity != null && quantity > 0;
  const hasWeight = netWeight != null && netWeight > 0;
  const hasUnit = unitSymbol != null && unitSymbol.trim() !== '';

  // Case 1: Both quantity and weight
  if (hasQuantity && hasWeight && hasUnit) {
    return (
      <View style={styles.container}>
        <QuantityDisplay
          quantity={quantity}
          quantityInput={quantityInput}
          displayFormat={displayFormat}
          displayAsFraction={displayAsFraction}
          showUnit={false}
          style={{ ...styles.quantity, color: theme.colors.textPrimary }}
        />
        <Text style={[styles.separator, { color: theme.colors.textSecondary }]}>
          {' × '}
        </Text>
        <Text style={[styles.weight, { color: theme.colors.textSecondary }]}>
          {netWeight} {unitSymbol}
        </Text>
        {additionalInfo && (
          <>
            <Text style={[styles.separator, { color: theme.colors.textSecondary }]}>
              {' • '}
            </Text>
            <Text style={[styles.additionalInfo, { color: theme.colors.textSecondary }]}>
              {additionalInfo}
            </Text>
          </>
        )}
      </View>
    );
  }

  // Case 2: Only quantity with unit (no weight)
  if (hasQuantity && hasUnit && !hasWeight) {
    return (
      <View style={styles.container}>
        <QuantityDisplay
          quantity={quantity}
          quantityInput={quantityInput}
          displayFormat={displayFormat}
          unitSymbol={unitSymbol}
          displayAsFraction={displayAsFraction}
          style={{ ...styles.quantity, color: theme.colors.textPrimary }}
        />
        {additionalInfo && (
          <>
            <Text style={[styles.separator, { color: theme.colors.textSecondary }]}>
              {' • '}
            </Text>
            <Text style={[styles.additionalInfo, { color: theme.colors.textSecondary }]}>
              {additionalInfo}
            </Text>
          </>
        )}
      </View>
    );
  }

  // Case 3: Only weight (no quantity)
  if (hasWeight && hasUnit && !hasQuantity) {
    return (
      <View style={styles.container}>
        <Text style={[styles.weight, { color: theme.colors.textSecondary }]}>
          {netWeight} {unitSymbol}
        </Text>
        {additionalInfo && (
          <>
            <Text style={[styles.separator, { color: theme.colors.textSecondary }]}>
              {' • '}
            </Text>
            <Text style={[styles.additionalInfo, { color: theme.colors.textSecondary }]}>
              {additionalInfo}
            </Text>
          </>
        )}
      </View>
    );
  }

  // Case 4: Only quantity (no weight, no unit)
  if (hasQuantity) {
    return (
      <View style={styles.container}>
        <QuantityDisplay
          quantity={quantity}
          quantityInput={quantityInput}
          displayFormat={displayFormat}
          displayAsFraction={displayAsFraction}
          showUnit={false}
          style={{ ...styles.quantity, color: theme.colors.textPrimary }}
        />
        {additionalInfo && (
          <>
            <Text style={[styles.separator, { color: theme.colors.textSecondary }]}>
              {' • '}
            </Text>
            <Text style={[styles.additionalInfo, { color: theme.colors.textSecondary }]}>
              {additionalInfo}
            </Text>
          </>
        )}
      </View>
    );
  }

  // Case 5: Only additional info (fallback)
  if (additionalInfo) {
    return (
      <View style={styles.container}>
        <Text style={[styles.additionalInfo, { color: theme.colors.textSecondary }]}>
          {additionalInfo}
        </Text>
      </View>
    );
  }

  // Case 6: No data at all
  return null;
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  quantity: {
    fontSize: theme.fonts.size.sm,
    fontWeight: '600',
  },
  weight: {
    fontSize: theme.fonts.size.sm,
    fontWeight: '400',
  },
  separator: {
    fontSize: theme.fonts.size.sm,
    fontWeight: '400',
  },
  additionalInfo: {
    fontSize: theme.fonts.size.sm,
    fontWeight: '400',
  },
}));
