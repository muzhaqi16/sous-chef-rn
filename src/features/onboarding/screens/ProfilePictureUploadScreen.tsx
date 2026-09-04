import React, { useState, useEffect } from 'react';
import { logger } from '#/utils/environment';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import { View, Dimensions, ScrollView, Linking } from 'react-native';
import { Text } from '#components/atoms/Text';
import { getWebAppUrl } from '#utils/environment';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import { Button } from '#components/molecules/Button';
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
import {
  validateImageFile,
  ImageValidationError,
} from '#utils/imageValidation';
import { imageErrorMessage, useImageUpload } from '#hooks/useImageUpload';
import { useOnboardingNavigation } from '#features/onboarding/hooks/useOnboardingNavigation';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { ImageFile } from '#/types/media';
import { ImageUploadPurpose } from '#/graphql/generated/schemaTypes';
import { useFocusEffect } from '@react-navigation/native';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useProfileData } from '#features/profile/hooks/useProfileData';
import { CachedImage } from '#components/atoms/CachedImage';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { PermissionService } from '#services/permissions/PermissionService';
import { useStore } from '#store';
import { LocalImage } from '#components/atoms/LocalImage';

/** Module-level helper to seed existing avatar URL from profile */
function syncExistingAvatar(
  avatar: string | null | undefined,
  setExistingAvatarUrl: (v: string | null) => void,
) {
  if (avatar) {
    setExistingAvatarUrl(avatar);
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
  const { toOnboardingImageCrop } = useAppNavigation();
  const { uploadProfileImage, updateProfileAvatarUrl } = useImageUpload();
  const { navigateToNextStep, navigateToPreviousStep, skipToStep } =
    useOnboardingNavigation();

  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [croppedImage, setCroppedImage] = useState<ImageFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(
    null,
  );

  const { profile, loading } = useProfileData();
  // Only the avatar placeholder waits on the request. The picker actions do not
  // depend on it, and `cache-and-network` reports loading for the whole network
  // leg — gating them on it removes the only way forward for its duration.
  const avatarLoading = loading && !profile;

  const hasLocalImage = !!(croppedImage || selectedImage);
  const hasExistingAvatar = !!existingAvatarUrl && !hasLocalImage;
  const hasAnyImage = hasExistingAvatar || hasLocalImage;

  // Collect whatever the crop screen left, once.
  useFocusEffect(() => {
    const pending = useStore.getState().takePendingCroppedImage();
    if (pending) {
      setCroppedImage(pending);
    }
  });

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
      // Its `message` is English by construction — for the log, never the user.
      alertService.alert(
        t('labels.invalidImage'),
        imageErrorMessage(t, validationError, true),
      );
    }
  };

  const handleTakePhoto = async () => {
    let permission;
    try {
      permission = await PermissionService.request('camera');
    } catch {
      launchCamera(DEFAULT_OPTIONS, handleImageResponse);
      return;
    }

    if (permission === 'granted') {
      launchCamera(DEFAULT_OPTIONS, handleImageResponse);
    } else {
      alertService.alert(
        t('labels.cameraPermission'),
        t('onBoarding.cameraPermissionTakePhotoMessage'),
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

    toOnboardingImageCrop({
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
          // No `onError`: `uploadProfileImage` already alerts, with copy it
          // resolved from the error's code. A second alert here showed the
          // same failure twice, and showed it from an Error whose message the
          // hook had already localized — so this could only repeat or regress
          // it.
          {},
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
          t('errors.uploadFailedTitle'),
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
      title={t('labels.profilePicture')}
      subtitle={t('onBoarding.profilePictureSubtitle')}
      step={5}
      totalSteps={8}
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
              <LocalImage
                accessibilityLabel={t('a11y.profilePreview')}
                uri={(croppedImage?.uri || selectedImage?.uri) ?? ''}
                style={styles.avatarImage}
              />
              <AppPressable
                onPress={handleRemoveImage}
                style={styles.avatarRemove}
                disabled={isUploading}
                accessibilityLabel={t('a11y.removePhoto')}
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
                accessibilityLabel={t('a11y.removePhoto')}
              >
                <Icon tone="error" name="close-circle" size={24} />
              </AppPressable>
            </>
          ) : avatarLoading ? (
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
              <Text role="bodyStrong" style={styles.cropButtonText}>
                {t('onBoarding.cropAndCenter')}
              </Text>
            </AppPressable>
            <Text role="caption" style={styles.cropHint}>
              {t('onBoarding.cropHint')}
            </Text>
          </View>
        )}

        {!hasAnyImage && (
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
                <Text role="bodyStrong" style={styles.uploadOptionLabel}>
                  {t('onBoarding.chooseFromGallery')}
                </Text>

                <Text role="caption" style={styles.uploadOptionDescription}>
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
          <Text role="caption" style={styles.formFooterText}>
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
    borderWidth: theme.borderWidth.medium,
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
    paddingVertical: theme.spacing.base,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
  },
  cropButtonText: {
    color: theme.colors.onPrimary,
  },
  cropHint: {
    fontStyle: 'italic',
    color: theme.colors.textSecondary,
  },
  formAction: {
    marginVertical: theme.spacing.sm,
    gap: theme.spacing.base,
  },
  uploadOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.medium,
    borderColor: theme.colors.border,
  },
  uploadOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.base,
  },
  uploadOptionContent: {
    flex: 1,
  },
  uploadOptionLabel: {
    marginBottom: theme.spacing.xs,
    color: theme.colors.textPrimary,
  },
  uploadOptionDescription: {
    letterSpacing: 0.16,
    color: theme.colors.textSecondary,
  },
  formFooter: {
    marginTop: 'auto',
    marginBottom: theme.spacing['2xl'],
    ...theme.type.body,
    textAlign: 'center',
    alignItems: 'center',
  },
  formFooterText: {
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
    ...theme.type.caption,
  },
}));
