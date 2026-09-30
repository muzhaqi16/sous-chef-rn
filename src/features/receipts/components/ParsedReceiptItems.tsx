import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { commonStyles } from '#/styles/commonStyles';
import { rowType } from '#/theme/foundations/type';
import { useMoney } from '#domain/money';
import {
  formatQuantityDisplay,
  formatQuantityForDisplay,
} from '#/utils/formatQuantity';
import type {
  ParsedReceipt,
  ParsedReceiptLine,
} from '../utils/structureReceipt';
import { receiptsTestIDs } from '../testIDs';

/** The item lines the phone's model read, each with its printed figures. */
export const ParsedReceiptItems: React.FC<{ receipt: ParsedReceipt }> = ({
  receipt,
}) => {
  const { t } = useTranslation();
  const money = useMoney();
  const items = receipt.lines.filter(line => line.kind === 'item');

  const perUnit = (line: ParsedReceiptLine) => {
    if (line.quantity === undefined || line.unitPrice === undefined) {
      return null;
    }
    return t('receipts.parsed.atPrice', {
      quantity: line.unit
        ? formatQuantityDisplay(line.quantity, line.unit)
        : formatQuantityForDisplay(line.quantity),
      price: money(line.unitPrice),
    });
  };

  return (
    <View testID={receiptsTestIDs.parsedItems}>
      <Text role="heading" style={styles.heading}>
        {t('receipts.parsed.title', { count: items.length })}
      </Text>
      {items.map(line => {
        const detail = perUnit(line);
        return (
          <View key={line.index} style={commonStyles.rowWrapper}>
            <View style={commonStyles.rowSurface}>
              <View style={commonStyles.rowContent}>
                <View style={styles.text}>
                  <Text role={rowType.title}>
                    {line.product ?? line.rawText}
                  </Text>
                  {!!detail && (
                    <Text role={rowType.subtitle} tone="secondary">
                      {detail}
                    </Text>
                  )}
                </View>
                <Text role={rowType.title}>{money(line.lineTotal)}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  heading: {
    marginBottom: theme.spacing.sm,
  },
  text: {
    flex: 1,
  },
}));
