'use no memo';

import { Platform } from 'react-native';

// Mock notifee
const mockDisplayNotification = jest.fn().mockResolvedValue(undefined);
const mockCancelNotification = jest.fn().mockResolvedValue(undefined);
const mockCancelAllNotifications = jest.fn().mockResolvedValue(undefined);
const mockGetBadgeCount = jest.fn().mockResolvedValue(5);
const mockSetBadgeCount = jest.fn().mockResolvedValue(undefined);
const mockCreateChannel = jest.fn().mockResolvedValue('default');
const mockOnForegroundEvent = jest.fn((_cb: (event: any) => void) => jest.fn()); // returns unsubscribe fn
const mockOnBackgroundEvent = jest.fn((_cb: (event: any) => Promise<void>) => {});

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    displayNotification: mockDisplayNotification,
    cancelNotification: mockCancelNotification,
    cancelAllNotifications: mockCancelAllNotifications,
    getBadgeCount: mockGetBadgeCount,
    setBadgeCount: mockSetBadgeCount,
    createChannel: mockCreateChannel,
    onForegroundEvent: mockOnForegroundEvent,
    onBackgroundEvent: mockOnBackgroundEvent,
  },
  AndroidImportance: {
    HIGH: 4,
    DEFAULT: 3,
  },
  AndroidStyle: {
    BIGTEXT: 1,
  },
}));

describe('localNotificationHelper', () => {
  let showLocalNotification: (params: { id: string; title: string; body: string; priority?: 'high' | 'default' | 'low' }) => Promise<void>;
  let cancelNotification: (id: string) => Promise<void>;
  let cancelAllNotifications: () => Promise<void>;
  let getBadgeCount: () => Promise<number>;
  let setBadgeCount: (count: number) => Promise<void>;
  let setupNotificationHandlers: () => () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    // Reset module to clear cached channel state
    jest.resetModules();
    const mod = require('../localNotificationHelper');
    showLocalNotification = mod.showLocalNotification;
    cancelNotification = mod.cancelNotification;
    cancelAllNotifications = mod.cancelAllNotifications;
    getBadgeCount = mod.getBadgeCount;
    setBadgeCount = mod.setBadgeCount;
    setupNotificationHandlers = mod.setupNotificationHandlers;
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    it('creates Android channel on Android platform', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

      await showLocalNotification({
        id: 'android-1',
        title: 'Android Test',
        body: 'Short body',
      });

      expect(mockCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'default',
          name: 'Default Channel',
        }),
      );

      Object.defineProperty(Platform, 'OS', { value: originalPlatform, writable: true });
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

      Object.defineProperty(Platform, 'OS', { value: originalPlatform, writable: true });
    });

    it('uses BIGTEXT style for long body on Android', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

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

      Object.defineProperty(Platform, 'OS', { value: originalPlatform, writable: true });
    });

    it('uses no style for short body on Android', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

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

      Object.defineProperty(Platform, 'OS', { value: originalPlatform, writable: true });
    });

    it('handles displayNotification error with Android fallback', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

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

      Object.defineProperty(Platform, 'OS', { value: originalPlatform, writable: true });
    });

    it('handles both original and fallback failure on Android', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

      mockDisplayNotification
        .mockRejectedValueOnce(new Error('Display failed'))
        .mockRejectedValueOnce(new Error('Fallback also failed'));

      // Should not throw
      await showLocalNotification({
        id: 'err-2',
        title: 'Double Error',
        body: 'Body',
      });

      Object.defineProperty(Platform, 'OS', { value: originalPlatform, writable: true });
    });

    it('handles displayNotification error without fallback on iOS', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      mockDisplayNotification.mockRejectedValueOnce(new Error('Display failed'));

      // Should not throw, and should not attempt fallback on iOS
      await showLocalNotification({
        id: 'err-ios',
        title: 'iOS Error',
        body: 'Body',
      });

      expect(mockDisplayNotification).toHaveBeenCalledTimes(1);

      Object.defineProperty(Platform, 'OS', { value: originalPlatform, writable: true });
    });

    it('accepts priority parameter', async () => {
      await showLocalNotification({
        id: 'pri-1',
        title: 'Priority Test',
        body: 'Body',
        priority: 'high',
      });

      expect(mockDisplayNotification).toHaveBeenCalled();
    });
  });

  describe('cancelNotification', () => {
    it('cancels a notification by id', async () => {
      await cancelNotification('cancel-1');
      expect(mockCancelNotification).toHaveBeenCalledWith('cancel-1');
    });

    it('handles cancel error gracefully', async () => {
      mockCancelNotification.mockRejectedValueOnce(new Error('Cancel failed'));
      await cancelNotification('fail-1');
      // Should not throw
    });
  });

  describe('cancelAllNotifications', () => {
    it('cancels all notifications', async () => {
      await cancelAllNotifications();
      expect(mockCancelAllNotifications).toHaveBeenCalled();
    });

    it('handles cancel all error gracefully', async () => {
      mockCancelAllNotifications.mockRejectedValueOnce(new Error('Cancel all failed'));
      await cancelAllNotifications();
      // Should not throw
    });
  });

  describe('getBadgeCount', () => {
    it('returns badge count on iOS', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      const count = await getBadgeCount();
      expect(count).toBe(5);
      expect(mockGetBadgeCount).toHaveBeenCalled();

      Object.defineProperty(Platform, 'OS', { value: originalPlatform, writable: true });
    });

    it('returns 0 on Android', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

      const count = await getBadgeCount();
      expect(count).toBe(0);
      expect(mockGetBadgeCount).not.toHaveBeenCalled();

      Object.defineProperty(Platform, 'OS', { value: originalPlatform, writable: true });
    });
  });

  describe('setBadgeCount', () => {
    it('sets badge count on iOS', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      await setBadgeCount(10);
      expect(mockSetBadgeCount).toHaveBeenCalledWith(10);

      Object.defineProperty(Platform, 'OS', { value: originalPlatform, writable: true });
    });

    it('does nothing on Android', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

      await setBadgeCount(10);
      expect(mockSetBadgeCount).not.toHaveBeenCalled();

      Object.defineProperty(Platform, 'OS', { value: originalPlatform, writable: true });
    });
  });

  describe('setupNotificationHandlers', () => {
    it('sets up foreground and background handlers', () => {
      const unsubscribe = setupNotificationHandlers();

      expect(mockOnForegroundEvent).toHaveBeenCalled();
      expect(mockOnBackgroundEvent).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('foreground handler processes PRESSED events', () => {
      setupNotificationHandlers();

      // Get the callback passed to onForegroundEvent
      const callback = mockOnForegroundEvent.mock.calls[0]?.[0] as
        | ((event: any) => void)
        | undefined;
      expect(typeof callback).toBe('function');

      // Simulate PRESSED event (type=1)
      callback?.({ type: 1, detail: { notification: { data: { screen: 'home' } } } });
      // Simulate DELIVERED event (type=0)
      callback?.({ type: 0, detail: { notification: { title: 'Test' } } });
      // Simulate DISMISSED event (type=2)
      callback?.({ type: 2, detail: { notification: { title: 'Test' } } });
    });

    it('background handler processes PRESSED events', () => {
      setupNotificationHandlers();

      const callback = mockOnBackgroundEvent.mock.calls[0]?.[0] as
        | ((event: any) => Promise<void>)
        | undefined;
      expect(typeof callback).toBe('function');

      // Simulate background PRESSED event
      callback?.({ type: 1, detail: { notification: { data: { screen: 'pantry' } } } });
    });
  });
});
