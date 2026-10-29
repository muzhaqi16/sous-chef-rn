import React from 'react';
import type { StaticScreenProps } from '@react-navigation/native';
import { useTranslation } from '#/i18n';
import { SubScreen } from '#components/templates/SubScreen';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { BudgetSection } from '#features/shoppingList/components/listBudget/BudgetSection';
import { StoreSection } from '#features/shoppingList/components/listBudget/StoreSection';
import { StoreComparisonSection } from '#features/shoppingList/components/listBudget/StoreComparisonSection';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { useListBudget } from './useListBudget';

/**
 * A list's money on a screen of its own: what it costs and may cost, the store
 * being shopped and where it's cheapest. Each control saves itself.
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
          <BudgetSection
            currency={list.currency}
            budgetAmount={list.budgetAmount}
            totalCost={list.totalCost}
            estimatedTotal={list.estimatedTotal}
            unpricedItems={list.unpricedItems}
            priceTracking={list.priceTracking}
            canEdit={budget.canEdit}
            onBudgetDone={input => budget.saveBudget(input) !== 'invalid'}
            onPriceTrackingChange={budget.setPriceTracking}
          />
          <StoreSection
            store={list.targetStore}
            canEdit={budget.canEdit}
            onPick={budget.pickStore}
          />
          <StoreComparisonSection listId={listId} />
        </>
      ) : null}
    </SubScreen>
  );
};
