import { Platform } from 'react-native';
import {
  registerFcmBackgroundHandler,
  registerFcmTapHandlers,
} from '../nativePushMessaging';
import {
  getMessaging,
  setBackgroundMessageHandler,
  onNotificationOpenedApp,
  getInitialNotification,
} from '@react-native-firebase/messaging';
import { showLocalNotification } from '#/services/notifications/localNotificationHelper';
import { routeNotificationTap } from '../pushNotificationRouting';
import { t } from '#/i18n';

jest.mock('#/services/notifications/localNotificationHelper', () => ({
  showLocalNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../pushNotificationRouting', () => ({
  routeNotificationTap: jest.fn(),
}));

const mockSetBackgroundHandler = setBackgroundMessageHandler as jest.Mock;
const mockOnNotificationOpenedApp = onNotificationOpenedApp as jest.Mock;
const mockGetInitialNotification = getInitialNotification as jest.Mock;
const mockShowLocal = showLocalNotification as jest.Mock;
const mockRouteTap = routeNotificationTap as jest.Mock;

const setPlatform = (os: 'android' | 'ios') => {
  Object.defineProperty(Platform, 'OS', { value: os, writable: true });
};

describe('nativePushMessaging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform('android');
    (getMessaging as jest.Mock).mockReturnValue({});
    mockGetInitialNotification.mockResolvedValue(null);
  });

  describe('registerFcmBackgroundHandler', () => {
    it('does nothing on iOS', () => {
      setPlatform('ios');
      registerFcmBackgroundHandler();
      expect(mockSetBackgroundHandler).not.toHaveBeenCalled();
    });

    it('registers a background handler on Android', () => {
      registerFcmBackgroundHandler();
      expect(mockSetBackgroundHandler).toHaveBeenCalledTimes(1);
    });

    it('draws a known type in local copy built from the payload names', async () => {
      registerFcmBackgroundHandler();
      const handler = mockSetBackgroundHandler.mock.calls[0][1];

      const data = {
        type: 'EXPIRY_REMINDER',
        title: 'Expiration Reminder',
        // Deliberately worded unlike the local copy, so the assertion below
        // distinguishes the two rather than matching a coincidence.
        body: 'Milk expires on 2026-09-19 UTC',
        itemName: 'Milk',
        // FCM stringifies every value; the copy builder reads a number.
        daysUntilExpiry: '3',
        notificationId: 'n1',
        category: 'PANTRY',
      };
      await handler({ messageId: 'm1', data });

      expect(mockShowLocal).toHaveBeenCalledWith({
        id: 'n1',
        title: t('notifications.copy.title.EXPIRY_REMINDER'),
        body: t('notifications.expiry.expiresInDays', {
          name: 'Milk',
          days: 3,
        }),
        data,
      });
      // The server's English is carried for the fallback path, never drawn.
      const drawn = mockShowLocal.mock.calls[0][0];
      expect(drawn.body).not.toBe('Milk expires on 2026-09-19 UTC');
    });

    it("falls back to the push's English for a type this build cannot word", async () => {
      registerFcmBackgroundHandler();
      const handler = mockSetBackgroundHandler.mock.calls[0][1];

      await handler({
        messageId: 'm1b',
        data: {
          type: 'QUARTERLY_DIGEST',
          title: 'Your quarter in food',
          body: 'You cooked 42 meals',
          notificationId: 'n1b',
        },
      });

      expect(mockShowLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Your quarter in food',
          body: 'You cooked 42 meals',
        }),
      );
    });

    it('falls back to generic copy when a name the sentence needs was dropped', async () => {
      registerFcmBackgroundHandler();
      const handler = mockSetBackgroundHandler.mock.calls[0][1];

      // The size budget drops trailing fields; `itemName` did not survive.
      await handler({
        messageId: 'm1c',
        data: {
          type: 'EXPIRY_REMINDER',
          title: 'Expiration Reminder',
          body: 'Milk expires in 3 days',
          notificationId: 'n1c',
        },
      });

      const drawn = mockShowLocal.mock.calls[0][0];
      expect(drawn.body).toBe(t('notifications.copy.message.expiryGeneric'));
      expect(drawn.body).not.toContain('{{');
    });

    it("states a coalesced push count in the reader's own plural form", async () => {
      registerFcmBackgroundHandler();
      const handler = mockSetBackgroundHandler.mock.calls[0][1];

      await handler({
        messageId: 'm1d',
        data: {
          title: '3 updates while you were away',
          body: 'Milk expiring; Bread low',
          coalescedCount: '3',
          coalescedTypes: '["EXPIRY_REMINDER","LOW_STOCK"]',
          notificationId: 'n1d',
        },
      });

      expect(mockShowLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          body: t('pushNotification.coalesced', { count: 3 }),
        }),
      );
    });

    it('shows an authored announcement as its author wrote it', async () => {
      registerFcmBackgroundHandler();
      const handler = mockSetBackgroundHandler.mock.calls[0][1];

      await handler({
        messageId: 'm1e',
        data: {
          type: 'NEW_ITEM_ADDED',
          title: 'Scheduled maintenance',
          body: 'The app is read-only on Sunday.',
          isAuthoredContent: 'true',
          notificationId: 'n1e',
        },
      });

      expect(mockShowLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Scheduled maintenance',
          body: 'The app is read-only on Sunday.',
        }),
      );
    });

    it('falls back to messageId when data has no notificationId', async () => {
      registerFcmBackgroundHandler();
      const handler = mockSetBackgroundHandler.mock.calls[0][1];

      await handler({ messageId: 'm2', data: { title: 'Hi', body: 'there' } });

      expect(mockShowLocal).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'm2' }),
      );
    });

    it('skips a message that carries a notification block (OS shows it)', async () => {
      registerFcmBackgroundHandler();
      const handler = mockSetBackgroundHandler.mock.calls[0][1];

      await handler({
        messageId: 'm3',
        notification: { title: 'Auto', body: 'displayed' },
        data: { title: 'Auto', body: 'displayed' },
      });

      expect(mockShowLocal).not.toHaveBeenCalled();
    });

    it('skips a data message with neither title nor body', async () => {
      registerFcmBackgroundHandler();
      const handler = mockSetBackgroundHandler.mock.calls[0][1];

      await handler({ messageId: 'm4', data: { category: 'SYSTEM' } });

      expect(mockShowLocal).not.toHaveBeenCalled();
    });
  });

  describe('registerFcmTapHandlers', () => {
    it('does nothing on iOS', () => {
      setPlatform('ios');
      const unsub = registerFcmTapHandlers();
      expect(mockOnNotificationOpenedApp).not.toHaveBeenCalled();
      expect(typeof unsub).toBe('function');
    });

    it('routes a background-tap open on Android', () => {
      registerFcmTapHandlers();
      const listener = mockOnNotificationOpenedApp.mock.calls[0][1];

      listener({ data: { category: 'SHOPPING' } });

      expect(mockRouteTap).toHaveBeenCalledWith({ category: 'SHOPPING' });
    });

    it('routes a cold-launch tap from getInitialNotification', async () => {
      mockGetInitialNotification.mockResolvedValue({
        data: { category: 'PANTRY' },
      });

      registerFcmTapHandlers();
      // let the getInitialNotification promise resolve
      await Promise.resolve();
      await Promise.resolve();

      expect(mockRouteTap).toHaveBeenCalledWith({ category: 'PANTRY' });
    });

    it('does not route when there is no launching notification', async () => {
      registerFcmTapHandlers();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockRouteTap).not.toHaveBeenCalled();
    });
  });
});
