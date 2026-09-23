import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type CameraOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { t as tGlobal, useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import {
  PermissionService,
  type PermissionStatus,
} from '#services/permissions/PermissionService';
import {
  validateImageFile,
  type ImageValidationError,
} from '#utils/imageValidation';
import { imageErrorMessage } from '#hooks/useImageUpload';
import type { ImageFile } from '#/types/media';

const CAPTURE_OPTIONS: CameraOptions = {
  mediaType: 'photo',
  includeBase64: false,
  maxHeight: 2000,
  maxWidth: 2000,
  quality: 0.8,
};

interface PhotoCaptureOptions {
  /** Profile photos validate against the avatar limits. */
  forProfile?: boolean;
  /** The library returns every selected photo, not just the first. */
  multiple?: boolean;
  /** Called per photo that fails validation; a single capture also alerts. */
  onInvalid?: (error: ImageValidationError) => void;
}

const toImageFile = (asset: Asset): ImageFile | null =>
  asset.uri
    ? {
        uri: asset.uri,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
        type: asset.type,
      }
    : null;

function validationErrorOf(
  imageFile: ImageFile,
  forProfile: boolean,
): ImageValidationError | null {
  try {
    validateImageFile(imageFile, forProfile);
    return null;
  } catch (error) {
    return error as ImageValidationError;
  }
}

async function requestCamera(): Promise<PermissionStatus | 'failed'> {
  try {
    return await PermissionService.request('camera');
  } catch (error) {
    errorService.reportError(error, { operation: 'usePhotoCapture.camera' });
    return 'failed';
  }
}

function alertNoCamera() {
  alertService.alert(tGlobal('errors.noCameraDevice'));
}

function alertCameraRefused(status: PermissionStatus) {
  const title = tGlobal('labels.cameraPermission');
  const message = tGlobal(
    'labels.cameraPermissionIsRequiredToTakePhotosPleaseEnableItInYourDeviceSettings',
  );
  if (status !== 'blocked') {
    alertService.alert(title, message);
    return;
  }
  // Blocked never prompts again; Settings is the only way back.
  alertService.alert(title, message, [
    { text: tGlobal('labels.cancel'), style: 'cancel' },
    {
      text: tGlobal('labels.openSettings'),
      onPress: () => {
        void PermissionService.openSettings().catch(error =>
          errorService.reportError(error, {
            operation: 'usePhotoCapture.openSettings',
          }),
        );
      },
    },
  ]);
}

/**
 * Takes or picks photos and returns the ones that pass validation; empty when
 * the user cancels or refuses the camera. Uploading stays with the caller.
 */
export const usePhotoCapture = ({
  forProfile = false,
  multiple = false,
  onInvalid,
}: PhotoCaptureOptions = {}) => {
  const { t } = useTranslation();

  const accept = (response: ImagePickerResponse): ImageFile[] => {
    if (response.errorCode === 'camera_unavailable') alertNoCamera();
    if (response.errorCode === 'permission') alertCameraRefused('denied');
    if (response.didCancel || response.errorCode) return [];
    const assets = response.assets ?? [];
    const images: ImageFile[] = [];
    for (const asset of multiple ? assets : assets.slice(0, 1)) {
      const imageFile = toImageFile(asset);
      if (!imageFile) continue;
      const error = validationErrorOf(imageFile, forProfile);
      if (!error) {
        images.push(imageFile);
        continue;
      }
      onInvalid?.(error);
      if (!multiple) {
        // The error's own message is English by construction; its code maps to copy.
        alertService.alert(
          t('labels.invalidImage'),
          imageErrorMessage(t, error, forProfile),
        );
      }
    }
    return images;
  };

  const takePhoto = async (): Promise<ImageFile[]> => {
    const status = await requestCamera();
    if (status === 'unavailable') {
      alertNoCamera();
      return [];
    }
    // A request that throws proves nothing; the picker asks for itself and
    // reports a refusal or a missing camera through `errorCode`.
    if (status !== 'granted' && status !== 'failed') {
      alertCameraRefused(status);
      return [];
    }
    return accept(await launchCamera(CAPTURE_OPTIONS));
  };

  // The system photo picker needs no permission on either platform.
  const pickPhoto = async (): Promise<ImageFile[]> =>
    accept(
      await launchImageLibrary({
        ...CAPTURE_OPTIONS,
        selectionLimit: multiple ? 0 : 1,
      }),
    );

  return { takePhoto, pickPhoto };
};
