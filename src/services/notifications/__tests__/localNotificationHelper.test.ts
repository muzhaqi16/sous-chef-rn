'use no memo';

import { Platform } from 'react-native';

type NotifeeEvent = {
  type: number;
  detail: { notification?: { data?: Record<string, unknown> } };
};

// Mock notifee — capture the registered handlers so tests can invoke them.
const mockDisplayNotification = jest.fn().mockResolvedValue(undefined);
const mockCreateChannel = jest.fn().mockResolvedValue('default');
let foregroundHandler: ((event: NotifeeEvent) => void) | undefined;
let backgroundHandler: ((event: NotifeeEvent) => Promise<void>) | undefined;
const mockOnForegroundEvent = jest.fn(
  (handler: (event: NotifeeEvent) => void) => {
    foregroundHandler = handler;
    return jest.fn();
  },
);
const mockOnBackgroundEvent = jest.fn(
  (handler: (event: NotifeeEvent) => Promise<void>) => {
    backgroundHandler = handler;
  },
);

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    displayNotification: mockDisplayNotification,
    createChannel: mockCreateChannel,
    onForegroundEvent: mockOnForegroundEvent,
    onBackgroundEvent: mockOnBackgroundEvent,
  },
  EventType: {
    DISMISSED: 2,
    PRESS: 1,
  },
  AndroidImportance: {
    HIGH: 4,
    DEFAULT: 3,
  },
  AndroidStyle: {
    BIGTEXT: 1,
  },
}));

// Isolate the tray helper from the deep-link router — assert it's invoked with
// the tapped notification's data, not that navigation actually happens.
const mockRouteNotificationTap = jest.fn();
jest.mock('#/services/push/pushNotificationRouting', () => ({
  routeNotificationTap: (...args: unknown[]) =>
    mockRouteNotificationTap(...args),
}));

describe('localNotificationHelper', () => {
  let showLocalNotification: (params: {
    id?: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }) => Promise<void>;
  let setupNotificationHandlers: () => () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module to clear cached channel state
    jest.resetModules();
    const mod = require('#/services/notifications/localNotificationHelper');
    showLocalNotification = mod.showLocalNotification;
    setupNotificationHandlers = mod.setupNotificationHandlers;
  });

  describe('showLocalNotification', () => {
    it('displays notification with required params', async () => {
      await showLocalNotification({
        id: 'test-1',
        title: 'Test Title',
        body: 'Test body content',
      });

      expect(mockDisplayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-1',
          title: 'Test Title',
          body: 'Test body content',
        }),
      );
    });

    it('forwards the data payload to the tray entry for tap routing', async () => {
      await showLocalNotification({
        id: 'test-2',
        title: 'Test Title',
        body: 'Test body',
        data: { category: 'SHOPPING', notificationId: 'test-2' },
      });

      expect(mockDisplayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { category: 'SHOPPING', notificationId: 'test-2' },
        }),
      );
    });

    it('creates Android channel on Android platform', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      await showLocalNotification({
        id: 'android-1',
        title: 'Android Test',
        body: 'Short body',
      });

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'default',
          name: 'General',
        }),
      );

      Object.defineProperty(Platform, 'OS', {
        value: originalPlatform,
        writable: true,
      });
    });

    /**
     * The channel name is the one piece of copy here the user reads outside a
     * notification — Android lists it under Settings › Apps › Notifications. A
     * plain "already created" boolean would pin it to whichever language was
     * active at the first notification of the session.
     */
    it('re-creates the channel under a new language so its name follows the UI', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });
      const { getI18n } = require('#/i18n/config');
      const i18n = getI18n();

      await showLocalNotification({ id: 'lang-1', title: 'T', body: 'B' });
      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'default', name: 'General' }),
      );

      // Same language again — the native call is still cached away.
      mockCreateChannel.mockClear();
      await showLocalNotification({ id: 'lang-2', title: 'T', body: 'B' });
      expect(mockCreateChannel).not.toHaveBeenCalled();

      await i18n.changeLanguage('sq');
      await showLocalNotification({ id: 'lang-3', title: 'T', body: 'B' });
      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'default', name: 'Të përgjithshme' }),
      );

      await i18n.changeLanguage('en');
      Object.defineProperty(Platform, 'OS', {
        value: originalPlatform,
        writable: true,
      });
    });

    it('skips channel creation on iOS', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      await showLocalNotification({
        id: 'ios-1',
        title: 'iOS Test',
        body: 'Short body',
      });

      expect(mockCreateChannel).not.toHaveBeenCalled();

      Object.defineProperty(Platform, 'OS', {
        value: originalPlatform,
        writable: true,
      });
    });

    it('uses BIGTEXT style for long body on Android', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      const longBody = 'A'.repeat(60); // > 50 chars
      await showLocalNotification({
        id: 'long-1',
        title: 'Long Body',
        body: longBody,
      });

      expect(mockDisplayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          android: expect.objectContaining({
            style: expect.objectContaining({
              type: 1, // AndroidStyle.BIGTEXT
              text: longBody,
            }),
          }),
        }),
      );

      Object.defineProperty(Platform, 'OS', {
        value: originalPlatform,
        writable: true,
      });
    });

    it('uses no style for short body on Android', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      await showLocalNotification({
        id: 'short-1',
        title: 'Short Body',
        body: 'Small',
      });

      expect(mockDisplayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          android: expect.objectContaining({
            style: undefined,
          }),
        }),
      );

      Object.defineProperty(Platform, 'OS', {
        value: originalPlatform,
        writable: true,
      });
    });

    it('handles displayNotification error with Android fallback', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      mockDisplayNotification
        .mockRejectedValueOnce(new Error('Display failed'))
        .mockResolvedValueOnce(undefined);

      await showLocalNotification({
        id: 'err-1',
        title: 'Error Test',
        body: 'Body',
      });

      // Should have been called twice (original + fallback)
      expect(mockDisplayNotification).toHaveBeenCalledTimes(2);
      // Fallback should use _fallback suffix
      expect(mockDisplayNotification).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: 'err-1_fallback',
        }),
      );

      Object.defineProperty(Platform, 'OS', {
        value: originalPlatform,
        writable: true,
      });
    });

    it('handles both original and fallback failure on Android', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      mockDisplayNotification
        .mockRejectedValueOnce(new Error('Display failed'))
        .mockRejectedValueOnce(new Error('Fallback also failed'));

      // Should not throw
      await showLocalNotification({
        id: 'err-2',
        title: 'Double Error',
        body: 'Body',
      });

      Object.defineProperty(Platform, 'OS', {
        value: originalPlatform,
        writable: true,
      });
    });

    it('handles displayNotification error without fallback on iOS', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      mockDisplayNotification.mockRejectedValueOnce(
        new Error('Display failed'),
      );

      // Should not throw, and should not attempt fallback on iOS
      await showLocalNotification({
        id: 'err-ios',
        title: 'iOS Error',
        body: 'Body',
      });

      expect(mockDisplayNotification).toHaveBeenCalledTimes(1);

      Object.defineProperty(Platform, 'OS', {
        value: originalPlatform,
        writable: true,
      });
    });
  });

  describe('setupNotificationHandlers', () => {
    it('registers foreground and background handlers', () => {
      const unsubscribe = setupNotificationHandlers();

      expect(mockOnForegroundEvent).toHaveBeenCalled();
      expect(mockOnBackgroundEvent).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    /**
     * Without this the new name reaches Android settings only when a
     * notification next happens to be shown, so a user who switches language and
     * then opens notification settings reads the previous one.
     */
    it('refreshes the channel name as soon as the language changes', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });
      const { getI18n } = require('#/i18n/config');
      const i18n = getI18n();

      setupNotificationHandlers();
      mockCreateChannel.mockClear();

      await i18n.changeLanguage('it');

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'default', name: 'Generale' }),
      );

      await i18n.changeLanguage('en');
      Object.defineProperty(Platform, 'OS', {
        value: originalPlatform,
        writable: true,
      });
    });

    it('routes a foreground PRESS to the tapped notification data', () => {
      setupNotificationHandlers();

      foregroundHandler?.({
        type: 1, // EventType.PRESS
        detail: { notification: { data: { category: 'PANTRY' } } },
      });

      expect(mockRouteNotificationTap).toHaveBeenCalledWith({
        category: 'PANTRY',
      });
    });

    it('routes a background PRESS to the tapped notification data', async () => {
      setupNotificationHandlers();

      await backgroundHandler?.({
        type: 1, // EventType.PRESS
        detail: { notification: { data: { category: 'SHOPPING' } } },
      });

      expect(mockRouteNotificationTap).toHaveBeenCalledWith({
        category: 'SHOPPING',
      });
    });

    it('ignores non-PRESS events', () => {
      setupNotificationHandlers();

      foregroundHandler?.({
        type: 2, // EventType.DISMISSED
        detail: { notification: { data: { category: 'PANTRY' } } },
      });

      expect(mockRouteNotificationTap).not.toHaveBeenCalled();
    });
  });
});
