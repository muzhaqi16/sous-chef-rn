import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { QuantityDisplay } from '#components/atoms/QuantityDisplay';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';

interface FormattedItemSubtitleProps {
  quantity?: number | null;
  initialQuantity?: number | null;
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
  initialQuantity,
  quantityInput,
  displayFormat,
  displayAsFraction,
  netWeight,
  unitSymbol,
  additionalInfo,
}) => {
  const { t } = useTranslation();

  // Check if this is a partially consumed single item
  // When initialQuantity is 1 and 0 < quantity < 1, display as "1" with remaining weight
  const isPartialSingleItem =
    initialQuantity === 1 && quantity != null && quantity > 0 && quantity < 1;

  // For partial single items, display quantity as 1 and use the actual weight from the server
  const displayQuantity = isPartialSingleItem ? 1 : quantity;
  // netWeight already contains the actual remaining weight from the server
  const displayWeight = netWeight;

  // Handle edge cases
  const hasQuantity = displayQuantity != null && displayQuantity >= 0;
  const hasWeight = displayWeight != null && displayWeight > 0;
  const hasUnit = unitSymbol != null && unitSymbol.trim() !== '';

  // Case 1: Both quantity and weight
  if (hasQuantity && hasWeight && hasUnit) {
    // Skip "1 ×" when quantity is 1 - just show weight (industry standard)
    // Use tolerance for floating point comparison
    // This also applies to partial single items (initialQuantity=1, quantity<1)
    const isQuantityOne =
      displayQuantity != null && Math.abs(displayQuantity - 1) < 0.001;
    if (isQuantityOne) {
      return (
        <View style={styles.container}>
          <Text role="caption" tone="primary">
            {displayWeight} {unitSymbol}
          </Text>
          {!!additionalInfo && (
            <>
              <Text role="caption" tone="secondary">
                {' • '}
              </Text>
              <Text role="caption" tone="secondary">
                {additionalInfo}
              </Text>
            </>
          )}
        </View>
      );
    }

    // Quantity > 1 or partial single item: show "2 × 100g" format
    return (
      <View style={styles.container}>
        <QuantityDisplay
          quantity={displayQuantity}
          quantityInput={isPartialSingleItem ? undefined : quantityInput}
          displayFormat={displayFormat}
          displayAsFraction={displayAsFraction}
          showUnit={false}
          style={styles.quantity}
        />
        <Text role="caption" tone="secondary">
          {' × '}
        </Text>
        <Text role="caption" tone="secondary">
          {isPartialSingleItem
            ? t('itemSubtitle.weightRemaining', {
                weight: displayWeight,
                unit: unitSymbol,
              })
            : t('itemSubtitle.weight', {
                weight: displayWeight,
                unit: unitSymbol,
              })}
        </Text>
        {!!additionalInfo && (
          <>
            <Text role="caption" tone="secondary">
              {' • '}
            </Text>
            <Text role="caption" tone="secondary">
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
          quantity={displayQuantity}
          quantityInput={isPartialSingleItem ? undefined : quantityInput}
          displayFormat={displayFormat}
          unitSymbol={unitSymbol}
          displayAsFraction={displayAsFraction}
          style={styles.quantity}
        />
        {!!isPartialSingleItem && (
          <Text role="caption" tone="secondary">
            {' '}
            {t('itemSubtitle.percentRemaining', {
              percent: Math.round(quantity! * 100),
            })}
          </Text>
        )}
        {!!additionalInfo && (
          <>
            <Text role="caption" tone="secondary">
              {' • '}
            </Text>
            <Text role="caption" tone="secondary">
              {additionalInfo}
            </Text>
          </>
        )}
      </View>
    );
  }

  // Case 3: Only weight (no quantity) - weight is primary info
  if (hasWeight && hasUnit && !hasQuantity) {
    return (
      <View style={styles.container}>
        <Text role="caption" tone="primary">
          {displayWeight} {unitSymbol}
        </Text>
        {!!additionalInfo && (
          <>
            <Text role="caption" tone="secondary">
              {' • '}
            </Text>
            <Text role="caption" tone="secondary">
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
          quantity={displayQuantity}
          quantityInput={isPartialSingleItem ? undefined : quantityInput}
          displayFormat={displayFormat}
          displayAsFraction={displayAsFraction}
          showUnit={false}
          style={styles.quantity}
        />
        {!!isPartialSingleItem && (
          <Text role="caption" tone="secondary">
            {' '}
            {t('itemSubtitle.percentRemaining', {
              percent: Math.round(quantity! * 100),
            })}
          </Text>
        )}
        {!!additionalInfo && (
          <>
            <Text role="caption" tone="secondary">
              {' • '}
            </Text>
            <Text role="caption" tone="secondary">
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
        <Text role="caption" tone="secondary">
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
    ...theme.type.label,
    color: theme.colors.textPrimary,
  },
}));
