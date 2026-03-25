'use no memo';

import { Platform } from 'react-native';

// Mock notifee
const mockDisplayNotification = jest.fn().mockResolvedValue(undefined);
const mockCreateChannel = jest.fn().mockResolvedValue('default');
const mockOnForegroundEvent = jest.fn(() => jest.fn());
const mockOnBackgroundEvent = jest.fn();

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
  let showLocalNotification: (params: {
    id: string;
    title: string;
    body: string;
  }) => Promise<void>;
  let setupNotificationHandlers: () => () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module to clear cached channel state
    jest.resetModules();
    const mod = require('../localNotificationHelper');
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
          name: 'Default Channel',
        }),
      );

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
  });
});
