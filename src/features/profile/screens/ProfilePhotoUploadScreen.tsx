import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { t as tGlobal } from '#/i18n';
import { View, Dimensions } from 'react-native';
import { BackButton } from '#components/atoms/BackButton';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Icon } from '#utils/iconUtils';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  MediaType,
  CameraOptions,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import { StyleSheet } from 'react-native-unistyles';
import {
  validateImageFile,
  ImageValidationError,
} from '#utils/imageValidation';
import { imageErrorMessage, useImageUpload } from '#hooks/useImageUpload';
import type { ImageFile } from '#/types/media';
import { ImageUploadPurpose } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { Text } from '#components/atoms/Text';
import { PermissionService } from '#services/permissions/PermissionService';
import { useStore } from '#store';
import { LocalImage } from '#components/atoms/LocalImage';
import { Screen } from '#components/templates/Screen';

const DEFAULT_OPTIONS: CameraOptions | ImageLibraryOptions = {
  mediaType: 'photo' as MediaType,
  includeBase64: false,
  maxHeight: 2000,
  maxWidth: 2000,
  quality: 0.8,
};

const { width: screenWidth } = Dimensions.get('window');
const AVATAR_SIZE = Math.min(screenWidth * 0.6, 250);

/** Module-level function for camera permission request.
 *  Extracted to avoid try-catch with conditional inside component body (React Compiler bailout). */
async function requestCameraAndLaunch(
  handleImageResponse: (response: ImagePickerResponse) => void,
): Promise<void> {
  const result = await PermissionService.request('camera');
  if (result === 'granted') {
    launchCamera(DEFAULT_OPTIONS, handleImageResponse);
  } else if (result === 'denied') {
    alertService.alert(
      tGlobal('profile.cameraPermissionDeniedTitle'),
      tGlobal(
        'labels.cameraPermissionIsRequiredToTakePhotosPleaseEnableItInYourDeviceSettings',
      ),
    );
  } else if (result === 'blocked') {
    alertService.alert(
      tGlobal('profile.cameraPermissionBlockedTitle'),
      tGlobal('profile.cameraPermissionBlockedMessage'),
    );
  } else {
    alertService.alert(
      tGlobal('labels.cameraPermission'),
      tGlobal(
        'labels.cameraPermissionIsRequiredToTakePhotosPleaseEnableItInYourDeviceSettings',
      ),
    );
  }
}

export const ProfilePhotoUploadScreen: React.FC = () => {
  const { t } = useTranslation();
  const { goBack, toImageCrop } = useAppNavigation();
  const { uploadProfileImage, updateProfileAvatarUrl } = useImageUpload();

  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [croppedImage, setCroppedImage] = useState<ImageFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Collect whatever the crop screen left, once.
  useFocusEffect(() => {
    const pending = useStore.getState().takePendingCroppedImage();
    if (pending) {
      setCroppedImage(pending);
    }
  });

  const handleImageResponse = (response: ImagePickerResponse) => {
    if (response.didCancel || response.errorCode || !response.assets?.[0]) {
      return;
    }

    const asset = response.assets[0];
    const imageFile: ImageFile = {
      uri: asset.uri!,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      type: asset.type,
    };

    try {
      validateImageFile(imageFile, true);
      setSelectedImage(imageFile);
      setCroppedImage(null); // Reset cropped image when new image is selected
    } catch (error) {
      const validationError = error as ImageValidationError;
      // Its `message` is English by construction — for the log, never the user.
      alertService.alert(
        t('labels.invalidImage'),
        imageErrorMessage(t, validationError, true),
      );
    }
  };

  const handleTakePhoto = async () => {
    try {
      await requestCameraAndLaunch(handleImageResponse);
    } catch (error) {
      errorService.reportError(error, {
        operation: 'ProfilePhotoUpload.cameraPermission',
      });
      alertService.alert(
        t('errors.permissionTitle'),
        t('profile.permissionErrorMessage'),
      );
    }
  };

  const handleSelectPhoto = () => {
    // Android Photo Picker doesn't require permissions
    // iOS also allows launching without explicit permission on modern versions
    launchImageLibrary(DEFAULT_OPTIONS, handleImageResponse);
  };

  const handleCropImage = () => {
    if (!selectedImage) return;

    toImageCrop({ imageFile: selectedImage });
  };

  const handleUpload = () => {
    const imageToUpload = croppedImage || selectedImage;
    if (!imageToUpload) return;

    executeWithLoadingState(
      async () => {
        const imageUrl = await uploadProfileImage(
          imageToUpload,
          ImageUploadPurpose.ProfileAvatar,
          // No `onError`: `uploadProfileImage` already alerts, with copy it
          // resolved from the error's code. A second alert here showed the
          // same failure twice, and showed it from an Error whose message the
          // hook had already localized — so this could only repeat or regress
          // it.
          {},
        );

        if (imageUrl) {
          // Update the profile avatar URL in the database
          await updateProfileAvatarUrl(imageUrl);
          goBack();
        }
      },
      setIsUploading,
      () => {
        alertService.alert(
          t('errors.uploadFailedTitle'),
          t('profile.updatePhotoFailed'),
        );
      },
    );
  };

  const handleRetake = () => {
    setSelectedImage(null);
    setCroppedImage(null);
  };

  return (
    <Screen scroll="list" gutter="none">
      <View style={styles.content}>
        <View style={styles.header}>
          <BackButton
            onPress={goBack}
            style={styles.headerBack}
            disabled={isUploading}
          />
          <Text role="display" align="center" style={styles.title}>
            {t('profile.uploadYourPhoto')}
          </Text>
        </View>

        <Text role="bodyStrong" align="center" tone="secondary">
          {croppedImage
            ? t('profile.photoReadyToUpload')
            : selectedImage
            ? t('profile.tapCropToAdjust')
            : t('profile.choosePicturePersonalize')}
        </Text>

        <View style={styles.avatar}>
          <View style={styles.avatarPreview}>
            {croppedImage || selectedImage ? (
              <LocalImage
                uri={(croppedImage?.uri || selectedImage?.uri) ?? ''}
                style={styles.avatarImage}
              />
            ) : (
              <Icon tone="textSecondary" name="person" size={100} />
            )}
          </View>

          {/* Show crop icon below image if not cropped yet */}
          {!!selectedImage && !croppedImage && (
            <AppPressable
              onPress={handleCropImage}
              accessibilityLabel={t('a11y.cropPhoto')}
              style={styles.cropIconButton}
              disabled={isUploading}
            >
              <Icon tone="background" name="crop" size={20} />
            </AppPressable>
          )}
        </View>

        {selectedImage ? (
          <View style={styles.buttonContainer}>
            <AppPressable
              onPress={handleUpload}
              style={styles.btn}
              disabled={isUploading}
            >
              <Text role="heading" style={styles.btnText}>
                {isUploading
                  ? t('loading.uploading')
                  : t('profile.uploadPhoto')}
              </Text>
            </AppPressable>

            <AppPressable
              onPress={handleRetake}
              style={styles.btnSecondary}
              disabled={isUploading}
            >
              <Text
                role="heading"
                tone="accent"
                style={styles.btnSecondaryText}
              >
                {t('profile.chooseDifferentPhoto')}
              </Text>
            </AppPressable>
          </View>
        ) : (
          <View style={styles.buttonContainer}>
            <AppPressable
              onPress={handleTakePhoto}
              style={styles.btn}
              disabled={isUploading}
            >
              <Text role="heading" style={styles.btnText}>
                {t('labels.takePhoto')}
              </Text>
            </AppPressable>

            <AppPressable
              onPress={handleSelectPhoto}
              style={styles.btnSecondary}
              disabled={isUploading}
            >
              <Text role="heading" style={styles.btnSecondaryText}>
                {t('profile.selectPhoto')}
              </Text>
            </AppPressable>
          </View>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  title: {
    marginBottom: theme.spacing.xsPlus,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.base,
    paddingTop: theme.spacing.sm,
  },
  headerBack: {
    padding: theme.spacing.sm,
    paddingTop: 0,
    position: 'relative',
    marginLeft: -theme.spacing.md,
  },
  avatar: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    alignItems: 'center',
    marginBottom: 'auto',
    padding: theme.spacing.xl,
  },
  avatarPreview: {
    marginTop: theme.spacing['3xl'],
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: AVATAR_SIZE / 2,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.medium,
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.primary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_SIZE / 2,
    borderCurve: 'continuous',
  },
  cropIconButton: {
    marginTop: theme.spacing.md,
    width: 48,
    height: 48,
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    ...theme.shadows.md,
  },
  buttonContainer: {
    gap: theme.spacing.base,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
    borderCurve: 'continuous',
    paddingVertical: theme.spacing.smPlus,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: theme.borderWidth.hairline,
    backgroundColor: theme.colors.primary,
  },
  btnText: {
    color: theme.colors.background,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
    borderCurve: 'continuous',
    paddingVertical: theme.spacing.smPlus,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: theme.borderWidth.medium,
    backgroundColor: 'transparent',
    borderColor: theme.colors.primary,
  },
  btnSecondaryText: {
    color: theme.colors.secondary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default ProfilePhotoUploadScreen;
