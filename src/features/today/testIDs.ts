/**
 * Today's testIDs, shared by the app and the e2e page objects. No imports:
 * Detox's Jest reads this by relative path, outside the aliases.
 */
export const todayTestIDs = {
  screen: 'today-screen',
  scroll: 'today-scroll',
  householdTitle: 'today-household-title',
  notificationsButton: 'today-notifications-button',
  statCard: (status: 'expired' | 'expiring' | 'lowStock') =>
    `today-stat-${status}`,
  mealRow: (id: string) => `today-meal-${id}`,
  nothingPlanned: 'today-nothing-planned',
  suggestionsSeeAll: 'today-suggestions-see-all',
  shoppingRow: 'today-shopping-row',
  firstRun: 'today-first-run',
};
