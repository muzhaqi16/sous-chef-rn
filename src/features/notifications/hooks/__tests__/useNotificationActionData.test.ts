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

/** An expiry reminder. */
function expiryReminder(
  overrides: Partial<DisplayNotification> = {},
): DisplayNotification {
  return {
    id: 'n1',
    type: NotificationType.ExpiryReminder,
    isAuthoredContent: false,
    category: NotificationCategory.Pantry,
    priority: Priority.Normal,
    data: null,
    isTest: false,
    details: null,
    sentAt: '2026-07-01T00:00:00Z',
    isRead: false,
    requiresAction: true,
    actionType: 'VIEW_EXPIRING_ITEMS',
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

    // A merge re-parents the batch: the server names the survivor.
    it('follows a merged stack', async () => {
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

    it('offers no link for a row that predates the stack field', async () => {
      const lookup = lookupMock();
      const { result } = renderHookWithApollo(
        () => useNotificationActionData(),
        { operationMocks: [lookup.mock] },
      );

      const link = await result.current.resolveExpirationLink(expiryReminder());

      expect(link).toBeNull();
      expect(lookup.fired).toEqual([]);
    });
  });
});
