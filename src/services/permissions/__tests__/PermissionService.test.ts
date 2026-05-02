import { PermissionService } from '../PermissionService';
import { Linking } from 'react-native';
import { check, request, RESULTS } from 'react-native-permissions';
import notifee, { AuthorizationStatus } from '@notifee/react-native';

// react-native-permissions and @notifee/react-native are already mocked in jest.setup.js

const mockCheck = check as jest.Mock;
const mockRequest = request as jest.Mock;
const mockGetNotificationSettings =
  notifee.getNotificationSettings as jest.Mock;
const mockRequestPermission = notifee.requestPermission as jest.Mock;

describe('PermissionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('check()', () => {
    it('uses react-native-permissions check for camera', async () => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);

      const result = await PermissionService.check('camera');

      expect(mockCheck).toHaveBeenCalledWith('ios.permission.CAMERA');
      expect(result).toBe('granted');
    });

    it('uses notifee.getNotificationSettings for notifications on iOS', async () => {
      mockGetNotificationSettings.mockResolvedValue({
        authorizationStatus: AuthorizationStatus.AUTHORIZED,
      });

      const result = await PermissionService.check('notifications');

      expect(mockGetNotificationSettings).toHaveBeenCalled();
      expect(result).toBe('granted');
    });
  });

  describe('request()', () => {
    it('short-circuits if already granted', async () => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);

      const result = await PermissionService.request('camera');

      expect(result).toBe('granted');
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('short-circuits if blocked', async () => {
      mockCheck.mockResolvedValue(RESULTS.BLOCKED);

      const result = await PermissionService.request('camera');

      expect(result).toBe('blocked');
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('requests permission if denied', async () => {
      mockCheck.mockResolvedValue(RESULTS.DENIED);
      mockRequest.mockResolvedValue(RESULTS.GRANTED);

      const result = await PermissionService.request('camera');

      expect(mockRequest).toHaveBeenCalledWith('ios.permission.CAMERA');
      expect(result).toBe('granted');
    });

    it('uses notifee.requestPermission for notifications on iOS', async () => {
      // First check returns undetermined so request proceeds
      mockGetNotificationSettings.mockResolvedValue({
        authorizationStatus: AuthorizationStatus.NOT_DETERMINED,
      });
      mockRequestPermission.mockResolvedValue({
        authorizationStatus: AuthorizationStatus.AUTHORIZED,
      });

      const result = await PermissionService.request('notifications');

      expect(mockRequestPermission).toHaveBeenCalled();
      expect(result).toBe('granted');
    });
  });

  describe('openSettings()', () => {
    it('on iOS opens "app-settings:" URL', async () => {
      const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

      await PermissionService.openSettings();

      expect(spy).toHaveBeenCalledWith('app-settings:');
      spy.mockRestore();
    });
  });

  describe('normalizeRNPermissionStatus', () => {
    it('maps GRANTED to granted', async () => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);
      const result = await PermissionService.check('camera');
      expect(result).toBe('granted');
    });

    it('maps LIMITED to granted', async () => {
      mockCheck.mockResolvedValue(RESULTS.LIMITED);
      const result = await PermissionService.check('camera');
      expect(result).toBe('granted');
    });

    it('maps DENIED to denied', async () => {
      mockCheck.mockResolvedValue(RESULTS.DENIED);
      const result = await PermissionService.check('camera');
      expect(result).toBe('denied');
    });

    it('maps BLOCKED to blocked', async () => {
      mockCheck.mockResolvedValue(RESULTS.BLOCKED);
      const result = await PermissionService.check('camera');
      expect(result).toBe('blocked');
    });

    it('maps UNAVAILABLE to blocked', async () => {
      mockCheck.mockResolvedValue(RESULTS.UNAVAILABLE);
      const result = await PermissionService.check('camera');
      expect(result).toBe('blocked');
    });
  });
});
