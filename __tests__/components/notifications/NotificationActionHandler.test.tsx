'use no memo';

import React from 'react';
import { act } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { Text } from '#components/atoms/Text';
import type { ComponentProps } from 'react';
import type { RootState } from '../../../src/store';
import {
  ExpirationAction,
  NotificationCategory,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import type { DisplayNotification } from '#features/notifications/utils/toDisplayNotification';
import { NotificationActionHandler } from '../../../src/features/notifications/components/NotificationActionHandler';

type NotificationActionRenderProps = Parameters<
  ComponentProps<typeof NotificationActionHandler>['children']
>[0];

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock(
  '../../../src/features/notifications/components/InvitationAcceptanceModal',
  () => ({
    InvitationAcceptanceModal: () => null,
  }),
);
type OnActionSelected = (
  notification: DisplayNotification,
  action: ExpirationAction,
) => void;
let mockOnActionSelected: OnActionSelected | undefined;
const mockSyncMarkAsRead = jest.fn();
const mockSyncMarkAction = jest.fn();
const mockSyncMarkRead = jest.fn();

jest.mock(
  '../../../src/features/notifications/components/ExpirationActionSheet',
  () => ({
    ExpirationActionSheet: ({
      onActionSelected,
    }: {
      onActionSelected: OnActionSelected;
    }) => {
      mockOnActionSelected = onActionSelected;
      return null;
    },
  }),
);
jest.mock(
  '../../../src/features/notifications/hooks/useExpirationNotificationSync',
  () => ({
    useExpirationNotificationSync: () => ({
      syncMarkAction: mockSyncMarkAction,
      syncMarkRead: mockSyncMarkRead,
    }),
  }),
);
jest.mock(
  '../../../src/features/notifications/hooks/useNotificationSync',
  () => ({
    useNotificationSync: () => ({
      syncMarkAsRead: mockSyncMarkAsRead,
      syncDelete: jest.fn(),
      syncMarkAllAsRead: jest.fn(),
    }),
  }),
);
jest.mock('../../../src/hooks/navigation/useAppNavigation');
jest.mock('../../../src/store/useAppStore', () => ({
  useAppStore: <T,>(selector: (state: RootState) => T): T =>
    selector({
      setSelectedHomeId: jest.fn(),
    } as Partial<RootState> as RootState),
}));

describe('NotificationActionHandler', () => {
  it('renders children with render prop', () => {
    const { getByText } = renderWithApollo(
      <NotificationActionHandler>
        {() => <Text>Child Content</Text>}
      </NotificationActionHandler>,
    );
    expect(getByText('Child Content')).toBeTruthy();
  });

  it('provides showInvitationModal to children', () => {
    let receivedProps!: NotificationActionRenderProps;
    renderWithApollo(
      <NotificationActionHandler>
        {props => {
          receivedProps = props;
          return <Text>Test</Text>;
        }}
      </NotificationActionHandler>,
    );
    expect(receivedProps.showInvitationModal).toBeDefined();
  });

  it('provides handleNotificationAction to children', () => {
    let receivedProps!: NotificationActionRenderProps;
    renderWithApollo(
      <NotificationActionHandler>
        {props => {
          receivedProps = props;
          return <Text>Test</Text>;
        }}
      </NotificationActionHandler>,
    );
    expect(receivedProps.handleNotificationAction).toBeDefined();
  });

  it('marks the generic notification read when an expiration action is chosen', () => {
    renderWithApollo(
      <NotificationActionHandler>
        {() => <Text>Test</Text>}
      </NotificationActionHandler>,
    );
    const notification: DisplayNotification = {
      id: 'n1',
      type: NotificationType.ExpiryReminder,
      isAuthoredContent: false,
      category: NotificationCategory.Pantry,
      priority: Priority.Normal,
      payload: { itemName: 'Milk', daysUntilExpiry: 1, pantryItemId: 'item-1' },
      sentAt: '2026-07-01T00:00:00Z',
      isRead: false,
      requiresAction: true,
      actionType: 'VIEW_EXPIRING_ITEMS',
      actionData: {},
      expirationNotificationId: 'exp-1',
    };

    act(() => mockOnActionSelected?.(notification, ExpirationAction.Consumed));

    expect(mockSyncMarkAction).toHaveBeenCalledWith(
      'n1',
      'exp-1',
      ExpirationAction.Consumed,
    );
    expect(mockSyncMarkAsRead).toHaveBeenCalledWith('n1');
  });
});
