import React from 'react';
import type { StaticScreenProps } from '@react-navigation/native';
import { useTranslation } from '#/i18n';
import { SubScreen } from '#components/templates/SubScreen';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { CostSummary } from '#features/shoppingList/components/listBudget/CostSummary';
import { StoreComparisonSection } from '#features/shoppingList/components/listBudget/StoreComparisonSection';
import { ListPriceSettings } from '#features/shoppingList/components/listBudget/ListPriceSettings';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { useListBudget } from './useListBudget';

/**
 * A list's money on a screen of its own, answers first: what is left to buy
 * costs and what that leaves of the budget, then where it's cheaper, then the
 * budget, store and price asks. Each control saves itself.
 */
export const ListBudget: React.FC<StaticScreenProps<{ listId: string }>> = ({
  route,
}) => {
  useScreenTransition('ListBudget');
  const { listId } = route.params;
  const { t } = useTranslation();
  const budget = useListBudget(listId);
  const { list } = budget;

  return (
    <SubScreen
      title={t('labels.budgetAndPrices')}
      scroll="form"
      state={{ value: budget.state, onRetry: budget.retry }}
      testID={shoppingListTestIDs.listBudgetScreen}
    >
      {list ? (
        <>
          <CostSummary
            currency={list.currency}
            budgetAmount={list.budgetAmount}
            totalCost={list.totalCost}
            costToGo={budget.costToGo}
            canEdit={budget.canEdit}
          />
          <StoreComparisonSection listId={listId} />
          <ListPriceSettings
            currency={list.currency}
            budgetAmount={list.budgetAmount}
            store={list.targetStore}
            priceTracking={list.priceTracking}
            canEdit={budget.canEdit}
            onBudgetDone={input => budget.saveBudget(input) !== 'invalid'}
            onPickStore={budget.pickStore}
            onPriceTrackingChange={budget.setPriceTracking}
          />
        </>
      ) : null}
    </SubScreen>
  );
};
