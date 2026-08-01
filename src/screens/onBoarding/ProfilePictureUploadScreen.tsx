import React, { useState, useEffect } from 'react';
import { logger } from '#/utils/environment';
import { errorService } from '#/services/errorService';
import { useTranslation } from 'react-i18next';
import {
  View,
  Image,
  Dimensions,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { Text } from '#components/atoms/Text';
import { getWebAppUrl } from '#utils/environment';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { Button } from '#components/base/Button';
import { Link } from '#components/atoms/Link';
import { Icon } from '#utils/iconUtils';
import { StyleSheet } from 'react-native-unistyles';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  MediaType,
  CameraOptions,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import {
  validateImageFile,
  ImageValidationError,
} from '#utils/imageValidation';
import { useImageUpload } from '#hooks/useImageUpload';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { ImageFile } from '#components/molecules/ImagePicker';
import { storage } from '#/storage/mmkv';
import { ImageUploadPurpose } from '#/graphql/generated/schemaTypes';
import { useFocusEffect } from '@react-navigation/native';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useProfileData } from '#features/profile/hooks/useProfileData';
import { CachedImage } from '#components/atoms/CachedImage';
import {
  executeWithLoadingState,
  executeMutation,
} from '#/utils/compilerSafeWrappers';

/** Module-level helper to seed existing avatar URL from profile */
function syncExistingAvatar(
  avatar: string | null | undefined,
  setExistingAvatarUrl: (v: string | null) => void,
) {
  if (avatar) {
    setExistingAvatarUrl(avatar);
  }
}

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
    errorService.reportError(error, { operation: 'readCroppedImage' });
    try {
      storage.remove('temp_cropped_image');
    } catch {
      // ignore
    }
    return null;
  }
}

const DEFAULT_OPTIONS: CameraOptions | ImageLibraryOptions = {
  mediaType: 'photo' as MediaType,
  includeBase64: false,
  maxHeight: 2000,
  maxWidth: 2000,
  quality: 0.8,
};

const { width: screenWidth } = Dimensions.get('window');
const AVATAR_SIZE = Math.min(screenWidth * 0.4, 200);

export const ProfilePictureUploadScreen = () => {
  const { t } = useTranslation();
  useScreenTransition('ProfilePictureUploadScreen');
  const { toImageCrop } = useAppNavigation();
  const { uploadProfileImage, updateProfileAvatarUrl } = useImageUpload();
  const { navigateToNextStep, navigateToPreviousStep, skipToStep } =
    useOnboardingNavigation();

  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [croppedImage, setCroppedImage] = useState<ImageFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(
    null,
  );

  const { profile, loading: profileLoading } = useProfileData();

  const hasLocalImage = !!(croppedImage || selectedImage);
  const hasExistingAvatar = !!existingAvatarUrl && !hasLocalImage;
  const hasAnyImage = hasExistingAvatar || hasLocalImage;

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

  // Seed existing avatar from profile on initial load
  useEffect(() => {
    if (!hasLocalImage) {
      syncExistingAvatar(profile?.avatar, setExistingAvatarUrl);
    }
  }, [profile?.avatar, hasLocalImage]);

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
      alertService.alert(
        t('onBoarding.invalidImageTitle'),
        validationError.message,
      );
    }
  };

  const handleTakePhoto = () => {
    // Pre-compute permission outside try-catch to avoid value block bailout
    const cameraPermission =
      Platform.OS === 'ios'
        ? PERMISSIONS.IOS.CAMERA
        : PERMISSIONS.ANDROID.CAMERA;

    executeMutation(
      async () => {
        const result = await request(cameraPermission);
        if (result === RESULTS.GRANTED) {
          launchCamera(DEFAULT_OPTIONS, handleImageResponse);
        } else {
          alertService.alert(
            t('onBoarding.cameraPermissionTitle'),
            t('onBoarding.cameraPermissionTakePhotoMessage'),
          );
        }
      },
      () => {
        launchCamera(DEFAULT_OPTIONS, handleImageResponse);
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

    toImageCrop({
      imageFile: selectedImage,
    });
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
              alertService.alert(
                t('onBoarding.uploadFailedTitle'),
                error.message,
              );
            },
          },
        );

        if (imageUrl) {
          await updateProfileAvatarUrl(imageUrl);
          navigateToNextStep('ProfilePictureUpload');
        }
      },
      setIsUploading,
      error => {
        errorService.reportError(error, { operation: 'uploadAvatar' });
        alertService.alert(
          t('onBoarding.uploadFailedTitle'),
          t('onBoarding.updateProfilePhotoFailed'),
        );
      },
    );
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setCroppedImage(null);
    setExistingAvatarUrl(null);
  };

  return (
    <OnBoardingWrapper
      title={t('onBoarding.profilePictureTitle')}
      subtitle={t('onBoarding.profilePictureSubtitle')}
      step={4}
      totalSteps={7}
      onBack={() => navigateToPreviousStep('ProfilePictureUpload')}
      onSkip={() => skipToStep('InviteMembers')}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarPreview}>
          {hasLocalImage ? (
            <>
              <Image
                alt="Profile preview"
                source={{ uri: croppedImage?.uri || selectedImage?.uri }}
                style={styles.avatarImage}
              />
              <AppPressable
                onPress={handleRemoveImage}
                style={styles.avatarRemove}
                disabled={isUploading}
              >
                <Icon tone="error" name="close-circle" size={24} />
              </AppPressable>
            </>
          ) : hasExistingAvatar ? (
            <>
              <CachedImage
                uri={existingAvatarUrl}
                style={styles.avatarImage}
                displaySize={200}
              />
              <AppPressable
                onPress={handleRemoveImage}
                style={styles.avatarRemove}
              >
                <Icon tone="error" name="close-circle" size={24} />
              </AppPressable>
            </>
          ) : profileLoading ? (
            <View style={styles.avatarPlaceholder}>
              <PrimaryActivityIndicator size="large" />
            </View>
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon tone="textSecondary" name="person" size={52} />
            </View>
          )}
        </View>

        {!!selectedImage && !croppedImage && (
          <View style={styles.cropContainer}>
            <AppPressable
              onPress={handleCropImage}
              style={styles.cropButton}
              disabled={isUploading}
            >
              <Text style={styles.cropButtonText}>
                {t('onBoarding.cropAndCenter')}
              </Text>
            </AppPressable>
            <Text style={styles.cropHint}>{t('onBoarding.cropHint')}</Text>
          </View>
        )}

        {!hasAnyImage && !profileLoading && (
          <View style={styles.formAction}>
            <AppPressable
              onPress={handleSelectPhoto}
              style={styles.uploadOption}
              disabled={isUploading}
            >
              <View style={styles.uploadOptionIcon}>
                <Icon tone="primary" name="images" size={24} />
              </View>

              <View style={styles.uploadOptionContent}>
                <Text style={styles.uploadOptionLabel}>
                  {t('onBoarding.chooseFromGallery')}
                </Text>

                <Text style={styles.uploadOptionDescription}>
                  {t('onBoarding.chooseFromGalleryDescription')}
                </Text>
              </View>

              <Icon tone="textSecondary" name="chevron-forward" size={20} />
            </AppPressable>

            <AppPressable
              onPress={handleTakePhoto}
              style={styles.uploadOption}
              disabled={isUploading}
            >
              <View style={styles.uploadOptionIcon}>
                <Icon tone="primary" name="camera" size={24} />
              </View>

              <View style={styles.uploadOptionContent}>
                <Text style={styles.uploadOptionLabel}>
                  {t('onBoarding.takeAPhoto')}
                </Text>

                <Text style={styles.uploadOptionDescription}>
                  {t('onBoarding.takeAPhotoDescription')}
                </Text>
              </View>

              <Icon tone="textSecondary" name="chevron-forward" size={20} />
            </AppPressable>
          </View>
        )}

        <View style={styles.formFooter}>
          <Text style={styles.formFooterText}>
            {t('onBoarding.legalNotice')}
          </Text>

          <View style={styles.formFooterLinks}>
            <Link
              variant="subtle"
              onPress={() =>
                Linking.openURL(getWebAppUrl('/terms-of-service')).catch(err =>
                  logger.warn('Failed to open URL:', err),
                )
              }
              style={styles.formFooterLinkText}
            >
              {t('onBoarding.termsOfService')}
            </Link>

            <Text style={styles.formFooterText}>
              {' '}
              {t('auth.legalAnd')}
              {'   '}
            </Text>

            <Link
              variant="subtle"
              onPress={() =>
                Linking.openURL(getWebAppUrl('/privacy-policy')).catch(err =>
                  logger.warn('Failed to open URL:', err),
                )
              }
              style={styles.formFooterLinkText}
            >
              {t('auth.privacyLink')}
            </Link>
          </View>
        </View>
      </ScrollView>
      <Button
        title={
          isUploading
            ? t('loading.uploading')
            : hasExistingAvatar
            ? t('labels.continue')
            : t('onBoarding.uploadAndContinue')
        }
        onPress={
          hasExistingAvatar
            ? () => navigateToNextStep('ProfilePictureUpload')
            : hasLocalImage
            ? handleUpload
            : () => {}
        }
        variant="primary"
        disabled={!hasAnyImage || isUploading}
      />
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  avatarPreview: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    position: 'relative',
    alignSelf: 'center',
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderCurve: 'continuous',
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRemove: {
    position: 'absolute',
    right: -4,
    top: -4,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: 0,
  },
  cropContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  cropButton: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
  },
  cropButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.white,
  },
  cropHint: {
    fontSize: theme.typography.fontSize.xs,
    fontStyle: 'italic',
    color: theme.colors.textSecondary,
  },
  formAction: {
    marginVertical: theme.spacing.sm,
    gap: theme.spacing['3'],
  },
  uploadOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  uploadOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing['3'],
  },
  uploadOptionContent: {
    flex: 1,
  },
  uploadOptionLabel: {
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.lineHeight.normal,
    fontWeight: theme.fonts.weight.semibold,
    marginBottom: theme.spacing.xs,
    color: theme.colors.textPrimary,
  },
  uploadOptionDescription: {
    fontSize: theme.typography.fontSize.sm - 1,
    lineHeight: theme.typography.lineHeight.tight,
    letterSpacing: 0.16,
    color: theme.colors.textSecondary,
  },
  formFooter: {
    marginTop: 'auto',
    marginBottom: theme.spacing['2xl'],
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.lineHeight.normal,
    fontWeight: theme.fonts.weight.regular,
    textAlign: 'center',
    alignItems: 'center',
  },
  formFooterText: {
    fontSize: theme.typography.fontSize.sm - 1,
    lineHeight: theme.typography.lineHeight.tight,
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
  formFooterLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  formFooterLinkText: {
    fontSize: theme.typography.fontSize.sm - 1,
    lineHeight: theme.typography.lineHeight.tight,
  },
  nextText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.bold,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
