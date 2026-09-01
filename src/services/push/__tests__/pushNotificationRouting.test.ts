import { routeNotificationTap } from '../pushNotificationRouting';
import NavigationService from '#/services/NavigationService';

jest.mock('#/services/NavigationService', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}));

const mockNavigate = NavigationService.navigate as jest.Mock;

describe('routeNotificationTap', () => {
  beforeEach(() => jest.clearAllMocks());

  it('routes a SHOPPING notification to the shopping list', () => {
    routeNotificationTap({ category: 'SHOPPING', notificationId: 'n1' });

    expect(mockNavigate).toHaveBeenCalledWith('Home', {
      screen: 'ShoppingList',
      params: { screen: 'ShoppingListMain' },
    });
  });

  it('routes a PANTRY notification to the pantry', () => {
    routeNotificationTap({ category: 'PANTRY', notificationId: 'n1' });

    expect(mockNavigate).toHaveBeenCalledWith('Home', {
      screen: 'Pantry',
      params: { screen: 'PantryMain' },
    });
  });

  it('routes a RECIPE notification to the recipes tab', () => {
    routeNotificationTap({ category: 'RECIPE', notificationId: 'n1' });

    expect(mockNavigate).toHaveBeenCalledWith('Home', {
      screen: 'Recipe',
      params: { screen: 'RecipeMain' },
    });
  });

  it('matches the category case-insensitively', () => {
    routeNotificationTap({ category: 'pantry', notificationId: 'n1' });

    expect(mockNavigate).toHaveBeenCalledWith('Home', {
      screen: 'Pantry',
      params: { screen: 'PantryMain' },
    });
  });

  it('opens the feed for home/system categories', () => {
    routeNotificationTap({ category: 'SYSTEM', notificationId: 'n1' });

    expect(mockNavigate).toHaveBeenCalledWith('Notifications');
  });

  it('opens the feed when no category is present', () => {
    routeNotificationTap({ notificationId: 'n1' });

    expect(mockNavigate).toHaveBeenCalledWith('Notifications');
  });

  it('opens the feed for null/undefined data instead of crashing', () => {
    routeNotificationTap(null);
    routeNotificationTap(undefined);

    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenNthCalledWith(1, 'Notifications');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, 'Notifications');
  });

  it('ignores a non-string category value', () => {
    // Notifee payloads can technically carry non-string values.
    const payload: Record<string, unknown> = {
      category: 42,
      notificationId: 'n1',
    };
    routeNotificationTap(payload);

    expect(mockNavigate).toHaveBeenCalledWith('Notifications');
  });
  /**
   * A push the server coalesced over a quiet-hours window stands for several
   * notifications: it carries no `notificationId`, its body names more than one
   * item, and `sourceId` survives pointing at the first alone. Routing it by
   * category opens one item out of four and reads as having lost the rest.
   */
  describe('a coalesced quiet-hours push', () => {
    it('opens the feed even though it carries a routable category', () => {
      routeNotificationTap({
        category: 'PANTRY',
        sourceId: 'pib_first',
        sourceType: 'PANTRY_ITEM_BATCH',
      });

      expect(mockNavigate).toHaveBeenCalledWith('Notifications');
    });

    it('never routes on sourceId', () => {
      routeNotificationTap({ sourceId: 'pib_first', category: 'SHOPPING' });

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('Notifications');
    });

    // A window holding one notification still sends that notification's own
    // payload, so the single-item case deep-links as it always did.
    it('still deep-links a window that held a single notification', () => {
      routeNotificationTap({ category: 'PANTRY', notificationId: 'n1' });

      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'Pantry',
        params: { screen: 'PantryMain' },
      });
    });
  });
});
