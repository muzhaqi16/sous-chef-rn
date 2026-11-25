import { CommonActions } from '@react-navigation/native';
import { routeNotificationTap } from '../pushNotificationRouting';
import NavigationService from '#services/NavigationService';
import { useNotificationStore } from '#features/notifications/store/notificationStore';

let mockNavigate: jest.SpyInstance;

// `pop` returns to a screen already open beneath instead of stacking another.
const opensTab = (tab: string, screen: string) =>
  CommonActions.navigate(
    'Home',
    { screen: tab, params: { screen } },
    { pop: true },
  );
// The detail lives in the Notifications stack: a root navigate never reaches an
// unfocused child, so the stack is named first.
const opensDetail = (id: string) =>
  CommonActions.navigate(
    'Notifications',
    { screen: 'NotificationDetail', params: { id } },
    { pop: true },
  );
const opensFeed = CommonActions.navigate('Notifications', undefined, {
  pop: true,
});

describe('routeNotificationTap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate = jest
      .spyOn(NavigationService, 'dispatch')
      .mockImplementation(() => undefined);
    useNotificationStore.getState().noteOpenedFromPush(null);
  });

  it('opens the detail of a notification no feature claims, when the push names it', () => {
    routeNotificationTap({ category: 'HOME', notificationId: 'n1' });

    expect(mockNavigate).toHaveBeenCalledWith(opensDetail('n1'));
  });

  // Marked read once the signed-in app is there, as a tap in the list is.
  it('leaves the notification a push names to be marked read', () => {
    routeNotificationTap({ category: 'PANTRY', notificationId: 'n2' });

    expect(useNotificationStore.getState().openedFromPush).toBe('n2');
  });

  it('marks nothing for a summary push, which names no one notification', () => {
    routeNotificationTap({ notificationId: 'summary-1' });

    expect(useNotificationStore.getState().openedFromPush).toBeNull();
  });

  it('routes a SHOPPING notification to the shopping list', () => {
    routeNotificationTap({ category: 'SHOPPING' });

    expect(mockNavigate).toHaveBeenCalledWith(
      opensTab('ShoppingList', 'ShoppingListMain'),
    );
  });

  it('routes a PANTRY notification to the pantry', () => {
    routeNotificationTap({ category: 'PANTRY' });

    expect(mockNavigate).toHaveBeenCalledWith(opensTab('Pantry', 'PantryMain'));
  });

  it('routes a RECIPE notification to the recipes tab', () => {
    routeNotificationTap({ category: 'RECIPE' });

    expect(mockNavigate).toHaveBeenCalledWith(opensTab('Recipe', 'RecipeMain'));
  });

  it('matches the category case-insensitively', () => {
    routeNotificationTap({ category: 'pantry' });

    expect(mockNavigate).toHaveBeenCalledWith(opensTab('Pantry', 'PantryMain'));
  });

  it('opens the feed for home/system categories', () => {
    routeNotificationTap({ category: 'SYSTEM' });

    expect(mockNavigate).toHaveBeenCalledWith(opensFeed);
  });

  it('opens the feed when no category is present', () => {
    routeNotificationTap({ notificationId: 'n1' });

    expect(mockNavigate).toHaveBeenCalledWith(opensFeed);
  });

  it('opens the feed for null/undefined data instead of crashing', () => {
    routeNotificationTap(null);
    routeNotificationTap(undefined);

    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenNthCalledWith(1, opensFeed);
    expect(mockNavigate).toHaveBeenNthCalledWith(2, opensFeed);
  });

  it('ignores a non-string category value', () => {
    // Notifee payloads can technically carry non-string values.
    const payload: Record<string, unknown> = { category: 42 };
    routeNotificationTap(payload);

    expect(mockNavigate).toHaveBeenCalledWith(opensFeed);
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

      expect(mockNavigate).toHaveBeenCalledWith(
        opensTab('Pantry', 'PantryMain'),
      );
    });

    it('deep-links a locally raised notification', () => {
      // Notifee builds this one on-device; there is no server id to carry.
      routeNotificationTap({ category: 'SHOPPING' });

      expect(mockNavigate).toHaveBeenCalledWith(
        opensTab('ShoppingList', 'ShoppingListMain'),
      );
    });

    it('never routes on sourceId', () => {
      // `sourceId` names one entity; the category is what maps to a screen.
      routeNotificationTap({ sourceId: 'pib_first' });

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith(opensFeed);
    });
  });

  describe('a summary push', () => {
    // Several deferred notifications delivered as one: the API names only the
    // set, so no row's category can pull the tap into that row's tab.
    it('opens the feed', () => {
      routeNotificationTap({
        coalescedCount: '3',
        coalescedTypes: '["EXPIRY_REMINDER","LOW_STOCK"]',
      });

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith(opensFeed);
    });
  });

  describe('a payload the sender did not fully populate', () => {
    it('deep-links on category alone', () => {
      routeNotificationTap({ category: 'PANTRY' });

      expect(mockNavigate).toHaveBeenCalledWith(
        opensTab('Pantry', 'PantryMain'),
      );
    });

    it('ignores an unmodelled correlation key', () => {
      routeNotificationTap({
        category: 'PANTRY',
        notificationId: 'n1',
        sourceId: 'pib_1',
        sourceType: 'PANTRY_ITEM_BATCH',
        type: 'LOW_STOCK',
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        opensTab('Pantry', 'PantryMain'),
      );
    });
  });
});
