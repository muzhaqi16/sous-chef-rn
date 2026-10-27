import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';
import { commonStyles } from '#/styles/commonStyles';
import { InfoRow } from '#components/atoms/InfoRow';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import {
  formatCurrency,
  formatNumberForInput,
} from '#/utils/formatters/number';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';

interface BudgetSectionProps {
  currency: string | null;
  budgetAmount: number | null;
  totalCost: number | null;
  estimatedTotal: number | null;
  unpricedItems: number;
  priceTracking: boolean;
  /** Who may change the limit and tracking; others read the figures. */
  canEdit: boolean;
  /** Saves the finished field; false when it isn't a number. */
  onBudgetDone: (input: string) => boolean;
  onPriceTrackingChange: (value: boolean) => void;
}

/**
 * What the list costs and may cost, as text first: the estimate, what was spent
 * and the budget with what's left. The limit and tracking save themselves.
 */
export const BudgetSection: React.FC<BudgetSectionProps> = ({
  currency,
  budgetAmount,
  totalCost,
  estimatedTotal,
  unpricedItems,
  priceTracking,
  canEdit,
  onBudgetDone,
  onPriceTrackingChange,
}) => {
  const { t } = useTranslation();
  const [budgetInput, setBudgetInput] = useState(() =>
    formatNumberForInput(budgetAmount),
  );
  const [budgetError, setBudgetError] = useState<string | null>(null);
  // A save, or another member's change, restates the field.
  const [seededFrom, setSeededFrom] = useState(budgetAmount);
  if (budgetAmount !== seededFrom) {
    setSeededFrom(budgetAmount);
    setBudgetInput(formatNumberForInput(budgetAmount));
  }

  const money = (amount: number | null) => formatCurrency(amount, currency);
  const budgetText =
    budgetAmount === null
      ? t('shoppingListScreens.budgetPlaceholder')
      : money(budgetAmount);
  const estimate = money(estimatedTotal);
  // The spend completing the list recorded, else its estimate. The estimate
  // covers every line, bought or not, so the two never add.
  const cost = totalCost ?? estimatedTotal;
  const remaining =
    budgetAmount === null || cost === null ? null : budgetAmount - cost;

  const remainingNote =
    remaining === null ? null : (
      <Text
        role="caption"
        tone={remaining < 0 ? 'danger' : 'secondary'}
        align="right"
        testID={shoppingListTestIDs.budgetRemaining}
      >
        {remaining < 0
          ? t('shoppingListScreens.budget.over', {
              amount: money(-remaining),
            })
          : t('shoppingListScreens.budget.left', {
              amount: money(remaining),
            })}
      </Text>
    );

  const finishBudget = () => {
    setBudgetError(
      onBudgetDone(budgetInput)
        ? null
        : t('shoppingListScreens.budget.invalid'),
    );
  };

  return (
    <View style={commonStyles.settingsSection}>
      <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
        {t('shoppingListScreens.budgetSection')}
      </Text>

      <InfoRow
        label={t('shoppingListScreens.estimatedTotalLabel')}
        value={estimate}
      >
        <View style={styles.trailing}>
          <Text role="bodyStrong" tone="secondary" align="right">
            {estimate}
          </Text>
          {unpricedItems > 0 ? (
            <Text role="caption" tone="secondary" align="right">
              {t('shoppingListScreens.unpricedItemsNote', {
                count: unpricedItems,
              })}
            </Text>
          ) : null}
        </View>
      </InfoRow>

      <InfoRow label={t('labels.totalSpent')} value={money(totalCost)} />

      {canEdit ? (
        <>
          {/* The owner reads the limit in its field; what's left sits under it. */}
          <BaseInput
            label={t('shoppingListScreens.budgetAmountLabel')}
            value={budgetInput}
            onChangeText={setBudgetInput}
            onEndEditing={finishBudget}
            keyboardType="decimal-pad"
            placeholder={t('shoppingListScreens.budgetPlaceholder')}
            errorMessage={budgetError ?? undefined}
            testID={shoppingListTestIDs.budgetInput}
          />
          {remainingNote}

          <View style={commonStyles.settingsRow}>
            <View style={commonStyles.settingsRowInfo}>
              <Text role="bodyStrong">
                {t('shoppingListScreens.priceTrackingLabel')}
              </Text>
              <Text role="caption" style={commonStyles.settingsRowDescription}>
                {t('shoppingListScreens.priceTrackingDesc')}
              </Text>
            </View>
            <BaseSwitch
              accessibilityLabel={t('shoppingListScreens.priceTrackingLabel')}
              value={priceTracking}
              onValueChange={onPriceTrackingChange}
              testID={shoppingListTestIDs.priceTrackingSwitch}
            />
          </View>
        </>
      ) : (
        <InfoRow
          label={t('shoppingListScreens.budgetAmountLabel')}
          value={budgetText}
        >
          <View style={styles.trailing}>
            <Text role="bodyStrong" tone="secondary" align="right">
              {budgetText}
            </Text>
            {remainingNote}
          </View>
        </InfoRow>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  trailing: {
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
}));
