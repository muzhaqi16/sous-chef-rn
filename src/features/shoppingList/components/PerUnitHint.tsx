import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';

interface PerUnitHintProps {
  /** Already formatted in its currency. */
  price: string;
  unit: string | null | undefined;
  style?: StyleProp<TextStyle>;
}

/** A total's split: "$1.50 per kg", or "per unit" for a line naming none. */
export const PerUnitHint: React.FC<PerUnitHintProps> = ({
  price,
  unit,
  style,
}) => {
  const { t } = useTranslation();
  return (
    <Text role="caption" tone="secondary" style={style}>
      {t(
        unit
          ? 'purchaseAmountSheet.perUnitOfHint'
          : 'purchaseAmountSheet.perUnitHint',
        { price, unit },
      )}
    </Text>
  );
};
