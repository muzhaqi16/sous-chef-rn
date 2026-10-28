import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Card } from '#components/atoms/Card';
import { Text } from '#components/atoms/Text';
import type {
  LastPaidLine,
  TypicalLine,
} from '#features/barcode/hooks/useStorePriceMemory';
import { barcodeTestIDs } from '#features/barcode/testIDs';

interface StorePriceSectionProps {
  lastPaid: LastPaidLine | null;
  usual: string | null;
  typical: TypicalLine | null;
}

const PriceLine: React.FC<{
  label: string;
  value: string;
  notes?: string[];
}> = ({ label, value, notes = [] }) => (
  <View style={styles.line}>
    <Text role="body" tone="secondary" style={styles.label}>
      {label}
    </Text>
    <View style={styles.value}>
      <Text role="bodyStrong" style={styles.valueText}>
        {value}
      </Text>
      {notes.map(note => (
        <Text
          key={note}
          role="caption"
          tone="secondary"
          style={styles.valueText}
        >
          {note}
        </Text>
      ))}
    </View>
  </View>
);

/**
 * Store mode's price memory for a scanned product: what the household last
 * paid and usually pays, and what it typically costs here. A line with nothing
 * behind it is left out, and with none the section is.
 */
export const StorePriceSection: React.FC<StorePriceSectionProps> = ({
  lastPaid,
  usual,
  typical,
}) => {
  const { t } = useTranslation();
  if (!lastPaid && !usual && !typical) return null;

  return (
    <Card style={styles.card} testID={barcodeTestIDs.storePrices}>
      <Text role="bodyStrong">{t('barcode.price.title')}</Text>
      {!!lastPaid && (
        <PriceLine
          label={t('barcode.price.lastPaid')}
          value={lastPaid.price}
          notes={[
            lastPaid.storeName
              ? t('barcode.price.paidAt', {
                  store: lastPaid.storeName,
                  date: lastPaid.paidOn,
                })
              : lastPaid.paidOn,
            ...(lastPaid.onSale ? [t('barcode.price.onSale')] : []),
          ]}
        />
      )}
      {!!usual && <PriceLine label={t('barcode.price.usual')} value={usual} />}
      {!!typical && (
        <PriceLine
          label={
            typical.chainName
              ? t('barcode.price.typicalAtChain', { chain: typical.chainName })
              : t('barcode.price.typicalHere')
          }
          value={typical.price}
        />
      )}
    </Card>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  label: {
    flexShrink: 0,
  },
  value: {
    flex: 1,
    alignItems: 'flex-end',
  },
  valueText: {
    textAlign: 'right',
  },
}));
