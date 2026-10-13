import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { GetExpirationNotificationsForPantryItemDocument } from '#features/notifications/graphql/expirationNotificationLookup.generated';
import { useNotificationActionData } from '#features/notifications/hooks/useNotificationActionData';
import type { DisplayNotification } from '#features/notifications/utils/toDisplayNotification';
import {
  NotificationCategory,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';

const mockSyncDelete = jest.fn();
jest.mock('#features/notifications/hooks/useNotificationSync', () => ({
  useNotificationSync: () => ({ syncDelete: mockSyncDelete }),
}));

/** An expiry reminder whose payload recorded `stack-at-send`. */
function expiryReminder(
  overrides: Partial<DisplayNotification> = {},
): DisplayNotification {
  return {
    id: 'n1',
    type: NotificationType.ExpiryReminder,
    isAuthoredContent: false,
    category: NotificationCategory.Pantry,
    priority: Priority.Normal,
    payload: {
      itemName: 'Milk',
      daysUntilExpiry: 1,
      pantryItemId: 'stack-at-send',
    },
    sentAt: '2026-07-01T00:00:00Z',
    isRead: false,
    requiresAction: true,
    actionType: 'VIEW_EXPIRING_ITEMS',
    actionData: {},
    ...overrides,
  };
}

/** The reminder the server holds for `n1`, whichever stack is asked for. */
const lookupMock = () =>
  recordMock(GetExpirationNotificationsForPantryItemDocument, {
    data: {
      me: {
        __typename: 'User',
        id: 'u1',
        expirationNotificationsConnection: {
          __typename: 'ExpirationNotificationConnection',
          edges: [
            {
              __typename: 'ExpirationNotificationEdge',
              node: {
                __typename: 'ExpirationNotification',
                id: 'exp-1',
                genericNotificationId: 'n1',
              },
            },
          ],
        },
      },
    },
  });

describe('useNotificationActionData', () => {
  beforeEach(() => jest.clearAllMocks());

  // Removing a notification only from the cache is not a terminal state: the
  // server still has it, so it returns on the next cold start.
  it('removes a notification durably rather than only locally', async () => {
    const { result } = renderHookWithApollo(() => useNotificationActionData(), {
      operationMocks: [],
    });

    result.current.removeNotification('notif-1');

    expect(mockSyncDelete).toHaveBeenCalledWith('notif-1');
  });

  describe('resolveExpirationLink', () => {
    it('looks the reminder up on the stack the server names', async () => {
      const lookup = lookupMock();
      const { result } = renderHookWithApollo(
        () => useNotificationActionData(),
        { operationMocks: [lookup.mock] },
      );

      const link = await result.current.resolveExpirationLink(
        expiryReminder({ pantryItemId: 'stack-at-send' }),
      );

      expect(lookup.fired).toEqual([{ pantryItemId: 'stack-at-send' }]);
      expect(link?.id).toBe('exp-1');
    });

    // A merge re-parents the batch: the payload still names the stack that was
    // merged away, the server names the survivor.
    it('follows a merged stack rather than the one the payload recorded', async () => {
      const lookup = lookupMock();
      const { result } = renderHookWithApollo(
        () => useNotificationActionData(),
        { operationMocks: [lookup.mock] },
      );

      const link = await result.current.resolveExpirationLink(
        expiryReminder({ pantryItemId: 'stack-survivor' }),
      );

      expect(lookup.fired).toEqual([{ pantryItemId: 'stack-survivor' }]);
      expect(link?.id).toBe('exp-1');
    });

    it('offers no link, and asks nothing, when the server names no stack', async () => {
      const lookup = lookupMock();
      const { result } = renderHookWithApollo(
        () => useNotificationActionData(),
        { operationMocks: [lookup.mock] },
      );

      const link = await result.current.resolveExpirationLink(
        expiryReminder({ pantryItemId: null }),
      );

      expect(link).toBeNull();
      expect(lookup.fired).toEqual([]);
    });

    it("falls back to the payload's stack for a notification that predates the field", async () => {
      const lookup = lookupMock();
      const { result } = renderHookWithApollo(
        () => useNotificationActionData(),
        { operationMocks: [lookup.mock] },
      );
      const cachedByPreviousBuild = expiryReminder();
      expect(cachedByPreviousBuild.pantryItemId).toBeUndefined();

      const link = await result.current.resolveExpirationLink(
        cachedByPreviousBuild,
      );

      expect(lookup.fired).toEqual([{ pantryItemId: 'stack-at-send' }]);
      expect(link?.id).toBe('exp-1');
    });

    it('offers no link when neither the server nor the payload names a stack', async () => {
      const lookup = lookupMock();
      const { result } = renderHookWithApollo(
        () => useNotificationActionData(),
        { operationMocks: [lookup.mock] },
      );

      const link = await result.current.resolveExpirationLink(
        expiryReminder({ payload: { itemName: 'Milk', daysUntilExpiry: 1 } }),
      );

      expect(link).toBeNull();
      expect(lookup.fired).toEqual([]);
    });
  });
});
