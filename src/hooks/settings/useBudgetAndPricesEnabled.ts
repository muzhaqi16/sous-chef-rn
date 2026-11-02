import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useMirroredSetting } from '#store/useAppStore';

/**
 * The build offers prices and budgets and the account turned them on. Off, or
 * never answered, the lists and the pantry show and ask for no price.
 */
export function useBudgetAndPricesEnabled(): boolean {
  const offered = useFeatureFlag('budgetAndPrices');
  const enabled = useMirroredSetting('budgetAndPrices');
  return offered && enabled === true;
}
