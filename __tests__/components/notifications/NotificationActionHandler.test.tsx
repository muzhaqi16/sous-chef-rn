'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { NotificationActionHandler } from '../../../src/components/notifications/NotificationActionHandler';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/components/notifications/InvitationAcceptanceModal', () => ({
  InvitationAcceptanceModal: () => null,
}));
jest.mock('../../../src/components/notifications/ExpirationActionSheet', () => ({
  ExpirationActionSheet: () => null,
}));
jest.mock('../../../src/hooks/notifications/useExpirationNotificationSync', () => ({
  useExpirationNotificationSync: () => ({
    syncMarkAction: jest.fn(),
    syncDismiss: jest.fn(),
    syncMarkRead: jest.fn(),
  }),
}));
jest.mock('../../../src/hooks/navigation/useAppNavigation');
jest.mock('../../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({ setSelectedHomeId: jest.fn() }),
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
    let receivedProps: any;
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
    let receivedProps: any;
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
