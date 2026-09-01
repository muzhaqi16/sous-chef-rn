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
    routeNotificationTap({ category: 'SHOPPING' });

    expect(mockNavigate).toHaveBeenCalledWith('Home', {
      screen: 'ShoppingList',
      params: { screen: 'ShoppingListMain' },
    });
  });

  it('routes a PANTRY notification to the pantry', () => {
    routeNotificationTap({ category: 'PANTRY' });

    expect(mockNavigate).toHaveBeenCalledWith('Home', {
      screen: 'Pantry',
      params: { screen: 'PantryMain' },
    });
  });

  it('routes a RECIPE notification to the recipes tab', () => {
    routeNotificationTap({ category: 'RECIPE' });

    expect(mockNavigate).toHaveBeenCalledWith('Home', {
      screen: 'Recipe',
      params: { screen: 'RecipeMain' },
    });
  });

  it('matches the category case-insensitively', () => {
    routeNotificationTap({ category: 'pantry' });

    expect(mockNavigate).toHaveBeenCalledWith('Home', {
      screen: 'Pantry',
      params: { screen: 'PantryMain' },
    });
  });

  it('opens the feed for home/system categories', () => {
    routeNotificationTap({ category: 'SYSTEM' });

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
    const payload: Record<string, unknown> = { category: 42 };
    routeNotificationTap(payload);

    expect(mockNavigate).toHaveBeenCalledWith('Notifications');
  });
  /**
   * `notificationId` is OPTIONAL on the wire. `readPushMessage` reads
   * `data.notificationId || message.messageId` precisely because an ordinary
   * push can arrive without it — an alternate sender, a nested APNs payload, a
   * Notifee local notification. So its absence says nothing about coalescing,
   * and treating it as a claim drops the deep link for every payload that
   * merely omits it.
   */
  describe('a payload carrying no notificationId', () => {
    it('still deep-links on its category', () => {
      routeNotificationTap({ category: 'PANTRY' });

      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'Pantry',
        params: { screen: 'PantryMain' },
      });
    });

    it('deep-links a locally raised notification', () => {
      // Notifee builds this one on-device; there is no server id to carry.
      routeNotificationTap({ category: 'SHOPPING' });

      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'ShoppingList',
        params: { screen: 'ShoppingListMain' },
      });
    });

    it('never routes on sourceId', () => {
      // `sourceId` names one entity; the category is what maps to a screen.
      routeNotificationTap({ sourceId: 'pib_first' });

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('Notifications');
    });
  });

  /**
   * `docs/api/notifications.md` lists `notificationId` as ALWAYS present, and
   * quiet hours DELAY each push rather than merging several into one. So an
   * absent id says nothing about coalescing — routing keys off `category`.
   */
  describe('a payload the sender did not fully populate', () => {
    it('deep-links on category alone', () => {
      routeNotificationTap({ category: 'PANTRY' });

      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'Pantry',
        params: { screen: 'PantryMain' },
      });
    });

    it('ignores an unmodelled correlation key', () => {
      routeNotificationTap({
        category: 'PANTRY',
        notificationId: 'n1',
        sourceId: 'pib_1',
        sourceType: 'PANTRY_ITEM_BATCH',
        type: 'LOW_STOCK',
      });

      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'Pantry',
        params: { screen: 'PantryMain' },
      });
    });
  });
});
