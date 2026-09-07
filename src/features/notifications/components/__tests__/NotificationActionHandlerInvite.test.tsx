'use no memo';
// An invite notification whose token is gone has no control to press: the modal
// can only say where the invite can be opened. Left in the feed it returns on
// every cold start and, unread, holds the badge with no in-app way to clear it —
// `removeNotification` is called only from accept and reject, both of which run
// after a server write this invite cannot make.

import React from 'react';
import { act } from '@testing-library/react-native';
import {
  renderWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  NotificationCategory,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import type { DisplayNotification as NotificationItem } from '#features/notifications/utils/toDisplayNotification';
import { NotificationActionHandler } from '../NotificationActionHandler';

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#features/notifications/store/notificationStore', () => ({
  useNotificationStore: Object.assign(
    <T,>(selector: (s: { linkExpirationData: jest.Mock }) => T): T =>
      selector({ linkExpirationData: jest.fn() }),
    {
      getState: () => ({ linkExpirationData: jest.fn() }),
      setState: jest.fn(),
      subscribe: jest.fn(),
    },
  ),
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: Object.assign(
    <T,>(selector: (state: { setHomeAndPantry: jest.Mock }) => T): T =>
      selector({ setHomeAndPantry: jest.fn() }),
    { getState: () => ({}), setState: jest.fn(), subscribe: jest.fn() },
  ),
}));

const mockRemoveNotification = jest.fn();
jest.mock('#features/notifications/hooks/useNotificationActionData', () => ({
  useNotificationActionData: () => ({
    resolveExpirationLink: jest.fn(),
    removeNotification: (...args: unknown[]) => mockRemoveNotification(...args),
  }),
}));

let capturedClose: (() => void) | null = null;
jest.mock(
  '#features/notifications/components/InvitationAcceptanceModal',
  () => ({
    InvitationAcceptanceModal: ({ onClose }: { onClose: () => void }) => {
      capturedClose = onClose;
      return null;
    },
  }),
);

jest.mock('#features/notifications/components/ExpirationActionSheet', () => ({
  ExpirationActionSheet: () => null,
}));

const inviteNotification = (
  payload: Record<string, unknown>,
): NotificationItem => ({
  id: 'n-invite',
  type: NotificationType.ExpiryReminder,
  category: NotificationCategory.Pantry,
  priority: Priority.Normal,
  title: 'You are invited',
  message: 'Join the Smith household',
  payload,
  sentAt: '2026-07-01T00:00:00Z',
  isRead: false,
  requiresAction: true,
  actionType: 'ACCEPT_HOME_INVITE',
  actionData: {},
  sourceId: 'invite-1',
});

type HandlerProps = {
  handleNotificationAction: (notification: NotificationItem) => void;
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
  capturedClose = null;
});

describe('an invite notification that can no longer be acted on', () => {
  it('leaves the feed when the dead-end surface is closed', async () => {
    const getActions = renderHandler();

    await act(async () => {
      getActions().handleNotificationAction(
        inviteNotification({ homeName: 'Smith', inviterName: 'Ada' }),
      );
    });
    await act(async () => {
      capturedClose?.();
    });

    expect(mockRemoveNotification).toHaveBeenCalledWith('n-invite');
  });

  it('stays in the feed while it can still be accepted', async () => {
    const getActions = renderHandler();

    await act(async () => {
      getActions().handleNotificationAction(
        inviteNotification({
          homeName: 'Smith',
          inviterName: 'Ada',
          token: 'invite-token',
        }),
      );
    });
    await act(async () => {
      capturedClose?.();
    });

    expect(mockRemoveNotification).not.toHaveBeenCalled();
  });
});
