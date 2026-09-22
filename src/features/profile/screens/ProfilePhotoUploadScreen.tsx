import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { View, Dimensions } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Icon } from '#utils/iconUtils';
import { StyleSheet } from 'react-native-unistyles';
import { useImageUpload } from '#hooks/useImageUpload';
import { usePhotoCapture } from '#hooks/usePhotoCapture';
import type { ImageFile } from '#/types/media';
import { ImageUploadPurpose } from '#/graphql/generated/schemaTypes';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { Text } from '#components/atoms/Text';
import { useStore } from '#store';
import { LocalImage } from '#components/atoms/LocalImage';
import { Screen } from '#components/templates/Screen';

const { width: screenWidth } = Dimensions.get('window');
const AVATAR_SIZE = Math.min(screenWidth * 0.6, 250);

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

  const { takePhoto, pickPhoto } = usePhotoCapture({ forProfile: true });

  const selectImage = ([imageFile]: ImageFile[]) => {
    if (!imageFile) return;
    setSelectedImage(imageFile);
    setCroppedImage(null);
  };

  const handleTakePhoto = async () => selectImage(await takePhoto());
  const handleSelectPhoto = async () => selectImage(await pickPhoto());

  const handleCropImage = () => {
    if (!selectedImage) return;

    toImageCrop({ imageFile: selectedImage });
  };

  const handleUpload = () => {
    const imageToUpload = croppedImage ?? selectedImage;
    if (!imageToUpload) return;

    void executeWithLoadingState(
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
    <Screen
      scroll="none"
      header={{
        title: t('profile.uploadYourPhoto'),
        // Presented from the bottom, so it closes; an upload in flight holds it.
        close: () => {
          if (!isUploading) goBack();
        },
      }}
    >
      <View style={styles.content}>
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
                uri={croppedImage?.uri ?? selectedImage?.uri ?? ''}
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
  content: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    paddingTop: theme.spacing.md,
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
}));

export default ProfilePhotoUploadScreen;
