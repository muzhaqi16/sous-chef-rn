'use no memo';
import React from 'react';
import { act, screen } from '@testing-library/react-native';
import {
  renderWithApollo,
  recordMock,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { GetExpirationNotificationsForPantryItemDocument } from '#features/notifications/graphql/expirationNotificationLookup.generated';
import {
  NotificationCategory,
  NotificationType,
} from '#/graphql/generated/schemaTypes';
import {
  NotificationPriority,
  type NotificationItem,
} from '#store/slices/notificationSlice';
import { NotificationActionHandler } from '../NotificationActionHandler';

jest.mock('#hooks/navigation/useAppNavigation');

const mockLinkExpirationData = jest.fn();
jest.mock('#store/useAppStore', () => ({
  useAppStore: Object.assign(
    <T,>(
      selector: (state: {
        setHomeAndPantry: jest.Mock;
        removeNotification: jest.Mock;
        linkExpirationData: jest.Mock;
      }) => T,
    ): T =>
      selector({
        setHomeAndPantry: jest.fn(),
        removeNotification: jest.fn(),
        linkExpirationData: mockLinkExpirationData,
      }),
    { getState: () => ({}), setState: jest.fn(), subscribe: jest.fn() },
  ),
}));

jest.mock(
  '#features/notifications/components/InvitationAcceptanceModal',
  () => ({
    InvitationAcceptanceModal: () => null,
  }),
);

jest.mock('#features/notifications/components/ExpirationActionSheet', () => ({
  ExpirationActionSheet: ({
    visible,
    notification,
  }: {
    visible: boolean;
    notification: NotificationItem | null;
  }) => {
    const { Text } = require('react-native');
    if (!visible || !notification) return null;
    return (
      <Text testID="sheet-content">
        {JSON.stringify({
          id: notification.id,
          expirationNotificationId: notification.expirationNotificationId,
          daysUntilExpiry: notification.daysUntilExpiry,
          pantryItemName: notification.pantryItemName,
        })}
      </Text>
    );
  },
}));

function buildNotification(
  overrides: Partial<NotificationItem> = {},
): NotificationItem {
  return {
    id: 'n1',
    type: NotificationType.ExpiryReminder,
    category: NotificationCategory.Pantry,
    priority: NotificationPriority.MEDIUM,
    title: 'Items Expiring Soon',
    message: 'Milk expires tomorrow',
    payload: { itemName: 'Milk', daysUntilExpiry: 1, pantryItemId: 'item-1' },
    sentAt: '2026-07-01T00:00:00Z',
    isRead: false,
    requiresAction: true,
    actionType: 'VIEW_EXPIRING_ITEMS',
    ...overrides,
  };
}

type HandlerProps = {
  showExpirationActionSheet: (notification: NotificationItem) => Promise<void>;
};

function renderHandler(operationMocks: MockedResponse[] = []) {
  let captured: HandlerProps | null = null;
  renderWithApollo(
    <NotificationActionHandler>
      {props => {
        captured = props;
        return <></>;
      }}
    </NotificationActionHandler>,
    { operationMocks },
  );
  return () => captured!;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('NotificationActionHandler — showExpirationActionSheet', () => {
  it('opens the sheet directly when expirationNotificationId is already linked, without a network call', async () => {
    const getActions = renderHandler([]);
    const notification = buildNotification({
      expirationNotificationId: 'exp-1',
    });

    await act(async () => {
      await getActions().showExpirationActionSheet(notification);
    });

    expect(screen.getByTestId('sheet-content')).toBeTruthy();
    expect(
      JSON.parse(screen.getByTestId('sheet-content').props.children),
    ).toMatchObject({
      id: 'n1',
      expirationNotificationId: 'exp-1',
    });
    expect(mockLinkExpirationData).not.toHaveBeenCalled();
  });

  it('resolves the missing link via pantryItemId and opens the sheet with the enriched data', async () => {
    const { mock, fired } = recordMock(
      GetExpirationNotificationsForPantryItemDocument,
      {
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
                    id: 'exp-resolved',
                    genericNotificationId: 'n1',
                    daysUntilExpiry: 1,
                    pantryItem: {
                      __typename: 'PantryItem',
                      id: 'item-1',
                      item: {
                        __typename: 'Item',
                        id: 'catalog-item-1',
                        name: 'Milk',
                        imageUrl: null,
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    );
    const getActions = renderHandler([mock]);
    const notification = buildNotification();

    await act(async () => {
      await getActions().showExpirationActionSheet(notification);
    });

    expect(fired).toContainEqual({ pantryItemId: 'item-1' });
    expect(mockLinkExpirationData).toHaveBeenCalledWith('n1', {
      expirationNotificationId: 'exp-resolved',
      daysUntilExpiry: 1,
      pantryItemName: 'Milk',
      pantryItemImageUrl: null,
    });
    expect(
      JSON.parse(screen.getByTestId('sheet-content').props.children),
    ).toMatchObject({
      id: 'n1',
      expirationNotificationId: 'exp-resolved',
      daysUntilExpiry: 1,
      pantryItemName: 'Milk',
    });
  });

  it('does nothing when no ExpirationNotification matches the tapped notification', async () => {
    const { mock } = recordMock(
      GetExpirationNotificationsForPantryItemDocument,
      {
        data: {
          me: {
            __typename: 'User',
            id: 'u1',
            expirationNotificationsConnection: {
              __typename: 'ExpirationNotificationConnection',
              edges: [],
            },
          },
        },
      },
    );
    const getActions = renderHandler([mock]);
    const notification = buildNotification();

    await act(async () => {
      await getActions().showExpirationActionSheet(notification);
    });

    expect(mockLinkExpirationData).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sheet-content')).toBeNull();
  });

  it('does nothing when the payload has no pantryItemId (e.g. a synthetic test notification)', async () => {
    const getActions = renderHandler([]);
    const notification = buildNotification({
      payload: { itemName: 'Milk', daysUntilExpiry: 1 },
    });

    await act(async () => {
      await getActions().showExpirationActionSheet(notification);
    });

    expect(mockLinkExpirationData).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sheet-content')).toBeNull();
  });
});
