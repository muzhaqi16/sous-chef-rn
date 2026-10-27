import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useUserPreference } from '#hooks/settings/useUserPreferences';

/** The build offers a list's budget and prices and this user turned them on. */
export function useBudgetAndPricesEnabled(): boolean {
  const offered = useFeatureFlag('budgetAndPrices');
  const [enabled] = useUserPreference('budgetAndPrices');
  return offered && enabled;
}
