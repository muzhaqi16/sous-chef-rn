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

    it('displays a data-only message via Notifee', async () => {
      registerFcmBackgroundHandler();
      const handler = mockSetBackgroundHandler.mock.calls[0][1];

      await handler({
        messageId: 'm1',
        data: {
          title: 'Milk expiring',
          body: 'Use it soon',
          notificationId: 'n1',
          category: 'PANTRY',
        },
      });

      expect(mockShowLocal).toHaveBeenCalledWith({
        id: 'n1',
        title: 'Milk expiring',
        body: 'Use it soon',
        data: {
          title: 'Milk expiring',
          body: 'Use it soon',
          notificationId: 'n1',
          category: 'PANTRY',
        },
      });
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
