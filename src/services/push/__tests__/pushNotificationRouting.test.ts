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

  it('matches the category case-insensitively', () => {
    routeNotificationTap({ category: 'pantry' });

    expect(mockNavigate).toHaveBeenCalledWith('Home', {
      screen: 'Pantry',
      params: { screen: 'PantryMain' },
    });
  });

  it('opens the feed for other categories', () => {
    routeNotificationTap({ category: 'RECIPE' });

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
});
