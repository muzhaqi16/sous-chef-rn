import React from 'react';
import { View } from 'react-native';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';
import { commonStyles } from '#/styles/commonStyles';
import { InfoRow } from '#components/atoms/InfoRow';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { formatCurrency } from '#/utils/formatters/number';

interface BudgetSectionProps {
  budgetInput: string;
  currency: string | null;
  estimatedTotal: number;
  handleTogglePriceTracking: (value: boolean) => void;
  isOwner: boolean;
  listId: string | undefined;
  priceTracking: boolean;
  setBudgetInput: (value: string) => void;
  totalCost: number;
}

/** the limit, the running totals, price tracking. Owner-only, and only for a list that already exists. */
export const BudgetSection: React.FC<BudgetSectionProps> = ({
  budgetInput,
  currency,
  estimatedTotal,
  handleTogglePriceTracking,
  isOwner,
  listId,
  priceTracking,
  setBudgetInput,
  totalCost,
}) => {
  const { t } = useTranslation();
  if (!listId || !isOwner) return null;

  return (
    <View style={commonStyles.settingsSection}>
      <Text style={commonStyles.settingsSectionTitle}>
        {t('shoppingListScreens.budgetSection')}
      </Text>

      <InfoRow
        label={t('labels.totalSpent')}
        value={formatCurrency(totalCost, currency)}
      />
      <InfoRow
        label={t('shoppingListScreens.estimatedTotalLabel')}
        value={formatCurrency(estimatedTotal, currency)}
      />

      <BaseInput
        label={t('shoppingListScreens.budgetAmountLabel')}
        value={budgetInput}
        onChangeText={setBudgetInput}
        keyboardType="numeric"
        placeholder={t('shoppingListScreens.budgetPlaceholder')}
      />

      <View style={commonStyles.settingsRow}>
        <View style={commonStyles.settingsRowInfo}>
          <Text style={commonStyles.settingsRowLabel}>
            {t('shoppingListScreens.priceTrackingLabel')}
          </Text>
          <Text style={commonStyles.settingsRowDescription}>
            {t('shoppingListScreens.priceTrackingDesc')}
          </Text>
        </View>
        <BaseSwitch
          accessibilityLabel={t('shoppingListScreens.priceTrackingLabel')}
          value={priceTracking}
          onValueChange={handleTogglePriceTracking}
        />
      </View>
    </View>
  );
};
