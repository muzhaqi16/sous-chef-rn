import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { detectScanType } from './fields';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { catalogTestIDs } from '#features/catalog/testIDs';

interface BarcodeInfoProps {
  scannedValue?: string;
  barcode?: string;
  format?: string;
}

/**
 * Read-only line showing the scanned UPC/SKU that seeded {@link AddItemForm},
 * its format trailing quietly. Renders nothing when neither value is present.
 */
export const BarcodeInfo: React.FC<BarcodeInfoProps> = ({
  scannedValue,
  barcode,
  format,
}) => {
  const { t } = useTranslation();
  const shownValue = firstNonBlank(scannedValue, barcode);
  if (shownValue === undefined) return null;

  return (
    <View style={styles.barcodeInfo}>
      <Text role="label" tone="secondary" style={styles.barcodeLabel}>
        {scannedValue && detectScanType(scannedValue) === 'sku'
          ? t('labels.sku')
          : t('barcode.upc')}
      </Text>
      <Text role="bodyStrong" style={styles.barcodeValue}>
        {shownValue}
      </Text>
      {!!format && (
        <Text
          role="caption"
          tone="secondary"
          style={styles.format}
          testID={catalogTestIDs.barcodeInfoFormat}
        >
          {format.toUpperCase()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  barcodeInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.smPlus,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.lg,
  },
  barcodeLabel: {
    textTransform: 'uppercase',
  },
  barcodeValue: {
    fontFamily: 'monospace',
  },
  // Right-aligned on the line; it wraps under the value only when space runs out.
  format: {
    marginLeft: 'auto',
  },
}));
