import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { t as tGlobal } from '#/i18n/t';
import { View, Image, Dimensions, Platform } from 'react-native';
import {
  ThemedBackButton,
  ThemedSafeAreaView,
} from '#components/atoms/themedComponents';
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
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { StyleSheet } from 'react-native-unistyles';
import {
  validateImageFile,
  ImageValidationError,
} from '#utils/imageValidation';
import { useImageUpload } from '#hooks/useImageUpload';
import { ImageFile } from '#components/molecules/ImagePicker';
import { storage } from '#/storage/mmkv';
import { ImageUploadPurpose } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';
import {
  executeWithLoadingState,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import { Text } from '#components/atoms/Text';

const DEFAULT_OPTIONS: CameraOptions | ImageLibraryOptions = {
  mediaType: 'photo' as MediaType,
  includeBase64: false,
  maxHeight: 2000,
  maxWidth: 2000,
  quality: 0.8,
};

const { width: screenWidth } = Dimensions.get('window');
const AVATAR_SIZE = Math.min(screenWidth * 0.6, 250);

/** Module-level function for reading any cropped image left behind by ImageCropScreen.
 *  Extracted to avoid try/catch inside useFocusEffect (React Compiler bailout). */
function readPendingCroppedImage(): ImageFile | null {
  try {
    const storedCroppedImage = storage.getString('temp_cropped_image');
    if (!storedCroppedImage) return null;
    const croppedImageFile = JSON.parse(storedCroppedImage) as ImageFile;
    storage.remove('temp_cropped_image');
    return croppedImageFile;
  } catch (error) {
    errorService.reportError(error, {
      operation: 'ProfilePhotoUpload.readCroppedImage',
    });
    // Clean up potentially corrupted data
    try {
      storage.remove('temp_cropped_image');
    } catch {
      // ignore
    }
    return null;
  }
}

/** Module-level function for camera permission request.
 *  Extracted to avoid try-catch with conditional inside component body (React Compiler bailout). */
async function requestCameraAndLaunch(
  handleImageResponse: (response: ImagePickerResponse) => void,
): Promise<void> {
  const permission =
    Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;
  const result = await request(permission);
  if (result === RESULTS.GRANTED) {
    launchCamera(DEFAULT_OPTIONS, handleImageResponse);
  } else if (result === RESULTS.DENIED) {
    alertService.alert(
      tGlobal('profile.cameraPermissionDeniedTitle'),
      tGlobal('profile.cameraPermissionDeniedMessage'),
    );
  } else if (result === RESULTS.BLOCKED) {
    alertService.alert(
      tGlobal('profile.cameraPermissionBlockedTitle'),
      tGlobal('profile.cameraPermissionBlockedMessage'),
    );
  } else {
    alertService.alert(
      tGlobal('profile.cameraPermissionTitle'),
      tGlobal('profile.cameraPermissionMessage'),
    );
  }
}

export const ProfilePhotoUploadScreen: React.FC = () => {
  const { t } = useTranslation();
  const { goBack, toPantryImageCrop } = useAppNavigation();
  const { uploadProfileImage, updateProfileAvatarUrl } = useImageUpload();

  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [croppedImage, setCroppedImage] = useState<ImageFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Check for cropped image from MMKV when screen comes into focus
  useFocusEffect(() => {
    const pending = readPendingCroppedImage();
    if (pending) {
      setCroppedImage(pending);
    }
  });

  // Clean up MMKV on unmount
  useEffect(() => {
    return () => {
      storage.remove('temp_cropped_image');
    };
  }, []);

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
      alertService.alert(t('profile.invalidImage'), validationError.message);
    }
  };

  const handleTakePhoto = () => {
    executeMutation(
      () => requestCameraAndLaunch(handleImageResponse),
      error => {
        errorService.reportError(error, {
          operation: 'ProfilePhotoUpload.cameraPermission',
        });
        alertService.alert(
          t('profile.permissionErrorTitle'),
          t('profile.permissionErrorMessage'),
        );
      },
    );
  };

  const handleSelectPhoto = () => {
    // Android Photo Picker doesn't require permissions
    // iOS also allows launching without explicit permission on modern versions
    launchImageLibrary(DEFAULT_OPTIONS, handleImageResponse);
  };

  const handleCropImage = () => {
    if (!selectedImage) return;

    toPantryImageCrop({ imageFile: selectedImage });
  };

  const handleUpload = () => {
    const imageToUpload = croppedImage || selectedImage;
    if (!imageToUpload) return;

    executeWithLoadingState(
      async () => {
        const imageUrl = await uploadProfileImage(
          imageToUpload,
          ImageUploadPurpose.ProfileAvatar,
          {
            onError: (error: Error) => {
              alertService.alert(t('profile.uploadFailedTitle'), error.message);
            },
          },
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
          t('profile.uploadFailedTitle'),
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
    <ThemedSafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <ThemedBackButton
            onPress={goBack}
            style={styles.headerBack}
            disabled={isUploading}
          />
          <Text size="3xl" weight="bold" align="center" style={styles.title}>
            {t('profile.uploadYourPhoto')}
          </Text>
        </View>

        <Text size="base" weight="medium" align="center" tone="secondary">
          {croppedImage
            ? t('profile.photoReadyToUpload')
            : selectedImage
            ? t('profile.tapCropToAdjust')
            : t('profile.choosePicturePersonalize')}
        </Text>

        <View style={styles.avatar}>
          <View style={styles.avatarPreview}>
            {croppedImage || selectedImage ? (
              <Image
                source={{ uri: croppedImage?.uri || selectedImage?.uri }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <Icon tone="textSecondary" name="person" size={100} />
            )}
          </View>

          {/* Show crop icon below image if not cropped yet */}
          {!!selectedImage && !croppedImage && (
            <AppPressable
              onPress={handleCropImage}
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
              <Text
                size="lg"
                lineHeight="relaxed"
                weight="semibold"
                style={styles.btnText}
              >
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
                size="lg"
                lineHeight="relaxed"
                weight="semibold"
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
              <Text
                size="lg"
                lineHeight="relaxed"
                weight="semibold"
                style={styles.btnText}
              >
                {t('profile.takePhoto')}
              </Text>
            </AppPressable>

            <AppPressable
              onPress={handleSelectPhoto}
              style={styles.btnSecondary}
              disabled={isUploading}
            >
              <Text
                size="lg"
                lineHeight="relaxed"
                weight="semibold"
                style={styles.btnSecondaryText}
              >
                {t('profile.selectPhoto')}
              </Text>
            </AppPressable>
          </View>
        )}
      </View>
    </ThemedSafeAreaView>
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
    marginBottom: theme.spacing.xs + 2,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing['3'],
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
    borderWidth: 2,
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
    gap: theme.spacing['3'],
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
    borderCurve: 'continuous',
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
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
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 2,
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
