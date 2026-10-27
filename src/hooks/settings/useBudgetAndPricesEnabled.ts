import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useUserPreference } from '#hooks/settings/useUserPreferences';

/**
 * The build offers prices and budgets and this user turned them on. Off, the
 * lists and the pantry show and ask for no price.
 */
export function useBudgetAndPricesEnabled(): boolean {
  const offered = useFeatureFlag('budgetAndPrices');
  const [enabled] = useUserPreference('budgetAndPrices');
  return offered && enabled;
}
