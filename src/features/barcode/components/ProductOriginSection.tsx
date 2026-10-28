import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Card } from '#components/atoms/Card';
import { Text } from '#components/atoms/Text';
import type { OriginLine } from '#features/barcode/hooks/useProductOrigin';
import { barcodeTestIDs } from '#features/barcode/testIDs';

interface ProductOriginSectionProps {
  lines: OriginLine[];
}

/**
 * Where a scanned product comes from and who owns its brand, each fact with
 * the source that states it. No fact shows no section.
 */
export const ProductOriginSection: React.FC<ProductOriginSectionProps> = ({
  lines,
}) => {
  const { t } = useTranslation();
  if (lines.length === 0) return null;

  return (
    <Card style={styles.card} testID={barcodeTestIDs.productOrigin}>
      <Text role="bodyStrong">{t('barcode.origin.title')}</Text>
      {lines.map(line => (
        <View key={line.key}>
          <Text role="body">{line.text}</Text>
          {!!line.source && (
            <Text role="caption" tone="secondary">
              {t('barcode.origin.sourceLabel', { source: line.source })}
            </Text>
          )}
        </View>
      ))}
    </Card>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
}));
