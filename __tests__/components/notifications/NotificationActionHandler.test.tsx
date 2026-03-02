'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { NotificationActionHandler } from '../../../src/components/notifications/NotificationActionHandler';

jest.mock('../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

jest.mock('../../../src/components/notifications/InvitationAcceptanceModal', () => ({
  InvitationAcceptanceModal: () => null,
}));
jest.mock('../../../src/hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({
    navigateTo: {
      profile: jest.fn(),
      notifications: jest.fn(),
      pantryMain: jest.fn(),
      shoppingListMain: jest.fn(),
    },
    navigate: jest.fn(),
  }),
}));
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
