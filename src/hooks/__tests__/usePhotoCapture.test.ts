import { renderHook } from '@testing-library/react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { Asset, ImagePickerResponse } from 'react-native-image-picker';
import { alertService } from '#/services/alertService';
import { PermissionService } from '#services/permissions/PermissionService';
import { MAX_IMAGE_SIZE, MAX_PROFILE_SIZE } from '#utils/imageValidation';
import { usePhotoCapture } from '../usePhotoCapture';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/services/errorService');

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#services/permissions/PermissionService', () => ({
  PermissionService: {
    request: jest.fn(),
    openSettings: jest.fn(() => Promise.resolve()),
  },
}));

const mockLaunchCamera = jest.mocked(launchCamera);
const mockLaunchLibrary = jest.mocked(launchImageLibrary);
const mockRequest = jest.mocked(PermissionService.request);
const mockAlert = jest.mocked(alertService.alert);

const asset = (name: string, fileSize = 1024): Asset => ({
  uri: `file:///${name}.jpg`,
  fileName: `${name}.jpg`,
  fileSize,
  type: 'image/jpeg',
});

const picked = (...assets: Asset[]): ImagePickerResponse => ({ assets });

const capture = (options?: Parameters<typeof usePhotoCapture>[0]) =>
  renderHook(() => usePhotoCapture(options)).result.current;

beforeEach(() => {
  jest.clearAllMocks();
  mockRequest.mockResolvedValue('granted');
});

describe('usePhotoCapture', () => {
  describe('takePhoto', () => {
    it('opens the camera once permission is granted', async () => {
      mockLaunchCamera.mockResolvedValue(picked(asset('a')));

      const images = await capture().takePhoto();

      expect(images.map(image => image.fileName)).toEqual(['a.jpg']);
      expect(mockAlert).not.toHaveBeenCalled();
    });

    it.each(['denied', 'undetermined'] as const)(
      'explains a %s camera without offering Settings',
      async status => {
        mockRequest.mockResolvedValue(status);

        expect(await capture().takePhoto()).toEqual([]);

        expect(mockLaunchCamera).not.toHaveBeenCalled();
        expect(mockAlert).toHaveBeenCalledTimes(1);
        expect(mockAlert.mock.calls[0]).toHaveLength(2);
      },
    );

    it('offers Settings for a blocked camera', async () => {
      mockRequest.mockResolvedValue('blocked');

      expect(await capture().takePhoto()).toEqual([]);

      const [, , buttons] = mockAlert.mock.calls[0] ?? [];
      buttons?.[1]?.onPress?.();
      expect(PermissionService.openSettings).toHaveBeenCalled();
    });

    it('explains a permission request that throws', async () => {
      mockRequest.mockRejectedValue(new Error('native'));

      expect(await capture().takePhoto()).toEqual([]);

      expect(mockLaunchCamera).not.toHaveBeenCalled();
      expect(mockAlert).toHaveBeenCalledTimes(1);
    });
  });

  describe('pickPhoto', () => {
    it('returns nothing when the user cancels', async () => {
      mockLaunchLibrary.mockResolvedValue({ didCancel: true });

      expect(await capture().pickPhoto()).toEqual([]);
      expect(mockAlert).not.toHaveBeenCalled();
    });

    it('keeps one photo and asks for one unless multiple', async () => {
      mockLaunchLibrary.mockResolvedValue(picked(asset('a'), asset('b')));

      const images = await capture().pickPhoto();

      expect(images).toHaveLength(1);
      expect(mockLaunchLibrary).toHaveBeenCalledWith(
        expect.objectContaining({ selectionLimit: 1 }),
      );
    });

    it('alerts and reports a single photo that fails validation', async () => {
      const onInvalid = jest.fn();
      mockLaunchLibrary.mockResolvedValue(
        picked(asset('big', MAX_PROFILE_SIZE + 1)),
      );

      const images = await capture({ forProfile: true, onInvalid }).pickPhoto();

      expect(images).toEqual([]);
      expect(onInvalid).toHaveBeenCalledTimes(1);
      expect(mockAlert).toHaveBeenCalledTimes(1);
    });

    it('returns the valid photos of a multiple pick and reports the rest', async () => {
      const onInvalid = jest.fn();
      mockLaunchLibrary.mockResolvedValue(
        picked(asset('a'), asset('big', MAX_IMAGE_SIZE + 1), asset('b')),
      );

      const images = await capture({ multiple: true, onInvalid }).pickPhoto();

      expect(images.map(image => image.fileName)).toEqual(['a.jpg', 'b.jpg']);
      expect(onInvalid).toHaveBeenCalledTimes(1);
      expect(mockAlert).not.toHaveBeenCalled();
      expect(mockLaunchLibrary).toHaveBeenCalledWith(
        expect.objectContaining({ selectionLimit: 0 }),
      );
    });
  });
});
