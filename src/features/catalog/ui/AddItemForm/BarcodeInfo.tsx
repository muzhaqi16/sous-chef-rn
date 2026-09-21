import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { detectScanType } from './fields';
import { firstNonBlank } from '#/utils/firstNonBlank';

interface BarcodeInfoProps {
  scannedValue?: string;
  barcode?: string;
  format?: string;
}

/**
 * Read-only banner showing the scanned UPC/SKU (and optional format) that
 * seeded {@link AddItemForm}. Renders nothing when neither value is present.
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
        <>
          <Text role="label" tone="secondary" style={styles.formatLabel}>
            {t('barcodeInfo.format')}
          </Text>
          <Text role="label" tone="onSurfaceVariant">
            {format.toUpperCase()}
          </Text>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  barcodeInfo: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.lg,
  },
  barcodeLabel: {
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  barcodeValue: {
    fontFamily: 'monospace',
    marginBottom: theme.spacing.sm,
  },
  formatLabel: {
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
}));
