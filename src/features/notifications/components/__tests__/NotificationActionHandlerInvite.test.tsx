'use no memo';
// `removeNotification` reaches the server, so closing the modal must never call
// it: an invite the user only read stays in their feed on every device. An
// invite whose token is gone is shown as un-actionable instead of removed.

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

describe('closing the invitation modal', () => {
  // The close control and the Android back button are the same `onClose` prop,
  // so one case covers both affordances.
  it('leaves an un-actionable invite in the feed', async () => {
    const getActions = renderHandler();

    await act(async () => {
      getActions().handleNotificationAction(
        inviteNotification({ homeName: 'Smith', inviterName: 'Ada' }),
      );
    });
    await act(async () => {
      capturedClose?.();
    });

    expect(mockRemoveNotification).not.toHaveBeenCalled();
  });

  it('leaves an invite that can still be accepted in the feed', async () => {
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

  it('deletes nothing when there is no invitation at all', async () => {
    const getActions = renderHandler();

    await act(async () => {
      getActions().handleNotificationAction(inviteNotification({}));
    });
    await act(async () => {
      capturedClose?.();
    });

    expect(mockRemoveNotification).not.toHaveBeenCalled();
  });

  it('reopens the same invite after it was closed', async () => {
    const getActions = renderHandler();
    const invite = inviteNotification({
      homeName: 'Smith',
      inviterName: 'Ada',
    });

    await act(async () => {
      getActions().handleNotificationAction(invite);
    });
    await act(async () => {
      capturedClose?.();
    });
    await act(async () => {
      getActions().handleNotificationAction(invite);
    });

    expect(mockRemoveNotification).not.toHaveBeenCalled();
    expect(capturedClose).not.toBeNull();
  });
});
