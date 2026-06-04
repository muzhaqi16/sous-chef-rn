'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import type { ComponentProps } from 'react';
import type { RootState } from '../../../src/store';
import { NotificationActionHandler } from '../../../src/features/notifications/components/NotificationActionHandler';

type NotificationActionRenderProps = Parameters<
  ComponentProps<typeof NotificationActionHandler>['children']
>[0];

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/features/notifications/components/InvitationAcceptanceModal', () => ({
  InvitationAcceptanceModal: () => null,
}));
jest.mock('../../../src/features/notifications/components/ExpirationActionSheet', () => ({
  ExpirationActionSheet: () => null,
}));
jest.mock('../../../src/features/notifications/hooks/useExpirationNotificationSync', () => ({
  useExpirationNotificationSync: () => ({
    syncMarkAction: jest.fn(),
    syncDismiss: jest.fn(),
    syncMarkRead: jest.fn(),
  }),
}));
jest.mock('../../../src/features/notifications/hooks/useNotificationSync', () => ({
  useNotificationSync: () => ({
    syncMarkAsRead: jest.fn(),
    syncMarkUnread: jest.fn(),
    syncDelete: jest.fn(),
    syncMarkAllAsRead: jest.fn(),
  }),
}));
jest.mock('../../../src/hooks/navigation/useAppNavigation');
jest.mock('../../../src/store/useAppStore', () => ({
  useAppStore: <T,>(selector: (state: RootState) => T): T =>
    selector({ setSelectedHomeId: jest.fn() } as Partial<RootState> as RootState),
}));

describe('NotificationActionHandler', () => {
  it('renders children with render prop', () => {
    const { getByText } = render(
      <NotificationActionHandler>
        {() => <Text>Child Content</Text>}
      </NotificationActionHandler>,
    );
    expect(getByText('Child Content')).toBeTruthy();
  });

  it('provides showInvitationModal to children', () => {
    let receivedProps!: NotificationActionRenderProps;
    render(
      <NotificationActionHandler>
        {(props) => {
          receivedProps = props;
          return <Text>Test</Text>;
        }}
      </NotificationActionHandler>,
    );
    expect(receivedProps.showInvitationModal).toBeDefined();
  });

  it('provides handleNotificationAction to children', () => {
    let receivedProps!: NotificationActionRenderProps;
    render(
      <NotificationActionHandler>
        {(props) => {
          receivedProps = props;
          return <Text>Test</Text>;
        }}
      </NotificationActionHandler>,
    );
    expect(receivedProps.handleNotificationAction).toBeDefined();
  });
});
