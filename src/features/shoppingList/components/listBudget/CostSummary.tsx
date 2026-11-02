import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { InfoRow } from '#components/atoms/InfoRow';
import { useTranslation } from '#/i18n';
import { commonStyles } from '#/styles/commonStyles';
import { formatCurrency } from '#/utils/formatters/number';
import {
  formatCostToGo,
  type ListCostToGo,
} from '#features/shoppingList/hooks/useListCostToGo';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';

interface CostSummaryProps {
  currency: string | null;
  budgetAmount: number | null;
  /** What was spent on bought lines. */
  totalCost: number | null;
  /** Null until the list is read. */
  costToGo: ListCostToGo | null;
  /** Points an editor at the budget field below. */
  canEdit: boolean;
}

/**
 * The list's answer first: what is left to buy and what it may cost, what was
 * spent, and what that leaves of the budget.
 */
export const CostSummary: React.FC<CostSummaryProps> = ({
  currency,
  budgetAmount,
  totalCost,
  costToGo,
  canEdit,
}) => {
  const { t } = useTranslation();
  const money = (amount: number) => formatCurrency(amount, currency);
  const price = costToGo ? formatCostToGo(costToGo) : null;

  const toGoText = () => {
    if (!costToGo) return null;
    if (costToGo.lines === 0) {
      return t('shoppingListScreens.costSummary.nothingToGo');
    }
    return price
      ? t('shoppingListScreens.approxPrice', { price })
      : t('shoppingListScreens.costSummary.noPrices');
  };
  const toGo = toGoText();

  const budgetLine = () => {
    if (budgetAmount === null) {
      return (
        <InfoRow
          label={t('shoppingListScreens.costSummary.budget')}
          value={t('shoppingListScreens.budgetPlaceholder')}
          showBorder={false}
        />
      );
    }
    const remaining = budgetAmount - (totalCost ?? 0) - (costToGo?.amount ?? 0);
    return (
      <InfoRow
        label={t('shoppingListScreens.costSummary.budget')}
        value={null}
        showBorder={false}
      >
        <Text
          role="bodyStrong"
          tone={remaining < 0 ? 'danger' : 'secondary'}
          align="right"
          testID={shoppingListTestIDs.budgetRemaining}
        >
          {remaining < 0
            ? t('shoppingListScreens.budget.over', {
                amount: money(-remaining),
              })
            : t('shoppingListScreens.costSummary.leftOf', {
                amount: money(remaining),
                budget: money(budgetAmount),
              })}
        </Text>
      </InfoRow>
    );
  };

  return (
    <View
      style={commonStyles.settingsSection}
      testID={shoppingListTestIDs.costSummary}
    >
      <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
        {t('shoppingListScreens.costSummary.title')}
      </Text>

      {toGo ? (
        <InfoRow label={t('shoppingListScreens.costSummary.toGo')} value={toGo}>
          <View style={styles.trailing}>
            <Text
              role="bodyStrong"
              tone="secondary"
              align="right"
              testID={shoppingListTestIDs.costToGo}
            >
              {toGo}
            </Text>
            {price && costToGo ? (
              <Text role="caption" tone="secondary" align="right">
                {t('shoppingListScreens.costSummary.priced', {
                  priced: costToGo.pricedLines,
                  count: costToGo.lines,
                })}
              </Text>
            ) : null}
          </View>
        </InfoRow>
      ) : null}

      <InfoRow
        label={t('labels.totalSpent')}
        value={formatCurrency(totalCost, currency)}
      />

      {budgetLine()}
      {budgetAmount === null && canEdit ? (
        <Text role="caption" tone="secondary">
          {t('shoppingListScreens.costSummary.setBudget')}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  trailing: {
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
}));
