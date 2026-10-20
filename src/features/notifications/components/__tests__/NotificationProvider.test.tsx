import React from 'react';
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import type { AwayNotification } from '#features/notifications/hooks/useNotifications';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';
import { showLocalNotification } from '#/services/notifications/localNotificationHelper';
import { NotificationProvider } from '../NotificationProvider';

let mockArrivedWhileAway:
  | ((notification: AwayNotification) => void)
  | undefined;

jest.mock('#features/notifications/hooks/useNotifications', () => ({
  useNotificationListener: (options: {
    onArrivedWhileAway: (notification: AwayNotification) => void;
  }) => {
    mockArrivedWhileAway = options.onArrivedWhileAway;
  },
}));
jest.mock('#/services/notifications/localNotificationHelper', () => ({
  showLocalNotification: jest.fn(() => Promise.resolve()),
}));
jest.mock('../usePushTapHandlers', () => ({ usePushTapHandlers: () => {} }));

const AWAY: AwayNotification = {
  id: 'n-1',
  title: 'Sam added milk',
  body: 'To the weekly list',
  category: NotificationCategory.Shopping,
};

const arriveWhileAway = (os: typeof Platform.OS): void => {
  jest.replaceProperty(Platform, 'OS', os);
  render(<NotificationProvider>{null}</NotificationProvider>);
  mockArrivedWhileAway?.(AWAY);
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.mocked(showLocalNotification).mockClear();
});

it('draws a notification that arrives while away on Android, in its own words', () => {
  arriveWhileAway('android');

  expect(showLocalNotification).toHaveBeenCalledWith({
    id: 'n-1',
    title: 'Sam added milk',
    body: 'To the weekly list',
    data: { category: NotificationCategory.Shopping, notificationId: 'n-1' },
  });
});

// The OS already draws the APNs alert for the same event.
it('draws nothing on iOS', () => {
  arriveWhileAway('ios');

  expect(showLocalNotification).not.toHaveBeenCalled();
});
