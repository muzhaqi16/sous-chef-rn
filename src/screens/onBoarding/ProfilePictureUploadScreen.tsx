import React, { useState, useEffect } from 'react';
import {
  View,
  Pressable,
  Text,
  Image,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { alertService } from '#/services/alertService';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { Button } from '#components/base/Button';
import { Icon } from '#utils/iconUtils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
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
import { ImageUploadPurpose } from '#generated';
import { useFocusEffect } from '@react-navigation/native';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useProfileData } from '#hooks/profile/useProfileData';
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
  useScreenTransition('ProfilePictureUploadScreen');
  const { navigateTo } = useAppNavigation();
  const { theme } = useUnistyles();
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
    try {
      const storedCroppedImage = storage.getString('temp_cropped_image');
      if (storedCroppedImage) {
        const croppedImageFile: ImageFile = JSON.parse(storedCroppedImage);

        setCroppedImage(croppedImageFile);

        // Clean up the temporary storage
        storage.remove('temp_cropped_image');
      }
    } catch (error) {
      console.error('Error reading cropped image from MMKV:', error);
      // Clean up potentially corrupted data
      storage.remove('temp_cropped_image');
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
      alertService.alert('Invalid Image', validationError.message);
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
            'Camera Permission',
            'Camera permission is required to take photos. Please enable it in your device settings.',
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

    navigateTo.imageCrop({
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
              alertService.alert('Upload Failed', error.message);
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
        console.error('Avatar upload error:', error);
        alertService.alert('Upload Failed', 'Failed to update profile photo');
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
      title="Profile Picture"
      subtitle="Add a photo to personalize your profile"
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
              <Pressable
                onPress={handleRemoveImage}
                style={({ pressed }) => [
                  styles.avatarRemove,
                  pressed && styles.pressed,
                ]}
                disabled={isUploading}
              >
                <Icon
                  color={theme.colors.error}
                  name="close-circle"
                  size={24}
                />
              </Pressable>
            </>
          ) : hasExistingAvatar ? (
            <>
              <CachedImage uri={existingAvatarUrl} style={styles.avatarImage} />
              <Pressable
                onPress={handleRemoveImage}
                style={({ pressed }) => [
                  styles.avatarRemove,
                  pressed && styles.pressed,
                ]}
              >
                <Icon
                  color={theme.colors.error}
                  name="close-circle"
                  size={24}
                />
              </Pressable>
            </>
          ) : profileLoading ? (
            <View style={styles.avatarPlaceholder}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon
                color={theme.colors.textSecondary}
                name="person"
                size={52}
              />
            </View>
          )}
        </View>

        {!!selectedImage && !croppedImage && (
          <View style={styles.cropContainer}>
            <Pressable
              onPress={handleCropImage}
              style={({ pressed }) => [
                styles.cropButton,
                { backgroundColor: theme.colors.primary },
                pressed && styles.pressed,
              ]}
              disabled={isUploading}
            >
              <Text
                style={[styles.cropButtonText, { color: theme.colors.white }]}
              >
                Crop & Center
              </Text>
            </Pressable>
            <Text
              style={[styles.cropHint, { color: theme.colors.textSecondary }]}
            >
              Recommended to optimize your photo
            </Text>
          </View>
        )}

        {!hasAnyImage && !profileLoading && (
          <View style={styles.formAction}>
            <Pressable
              onPress={handleSelectPhoto}
              style={({ pressed }) => [
                styles.uploadOption,
                pressed && styles.pressed,
              ]}
              disabled={isUploading}
            >
              <View style={styles.uploadOptionIcon}>
                <Icon color={theme.colors.primary} name="images" size={24} />
              </View>

              <View style={styles.uploadOptionContent}>
                <Text
                  style={[
                    styles.uploadOptionLabel,
                    { color: theme.colors.textPrimary },
                  ]}
                >
                  Choose from Gallery
                </Text>

                <Text
                  style={[
                    styles.uploadOptionDescription,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Select a photo from your device
                </Text>
              </View>

              <Icon
                color={theme.colors.textSecondary}
                name="chevron-forward"
                size={20}
              />
            </Pressable>

            <Pressable
              onPress={handleTakePhoto}
              style={({ pressed }) => [
                styles.uploadOption,
                pressed && styles.pressed,
              ]}
              disabled={isUploading}
            >
              <View style={styles.uploadOptionIcon}>
                <Icon color={theme.colors.primary} name="camera" size={24} />
              </View>

              <View style={styles.uploadOptionContent}>
                <Text
                  style={[
                    styles.uploadOptionLabel,
                    { color: theme.colors.textPrimary },
                  ]}
                >
                  Take a Photo
                </Text>

                <Text
                  style={[
                    styles.uploadOptionDescription,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Use your camera to take a new photo
                </Text>
              </View>

              <Icon
                color={theme.colors.textSecondary}
                name="chevron-forward"
                size={20}
              />
            </Pressable>
          </View>
        )}

        <View style={styles.formFooter}>
          <Text
            style={[
              styles.formFooterText,
              { color: theme.colors.textSecondary },
            ]}
          >
            By continuing you agree to our
          </Text>

          <View style={styles.formFooterLinks}>
            <Pressable
              onPress={() => {
                // handle onPress
              }}
              style={({ pressed }) => [
                styles.formFooterLink,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.formFooterLinkText,
                  { color: theme.colors.primary },
                ]}
              >
                Terms of Service
              </Text>
            </Pressable>

            <Text
              style={[
                styles.formFooterText,
                { color: theme.colors.textSecondary },
              ]}
            >
              {' '}
              and
              {'   '}
            </Text>

            <Pressable
              onPress={() => {
                // handle onPress
              }}
              style={({ pressed }) => [
                styles.formFooterLink,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.formFooterLinkText,
                  { color: theme.colors.primary },
                ]}
              >
                Privacy Policy
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Button
        title={
          isUploading
            ? 'Uploading...'
            : hasExistingAvatar
            ? 'Continue'
            : 'Upload & Continue'
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
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
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
    marginBottom: theme.spacing.sm,
  },
  cropButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  cropHint: {
    fontSize: theme.typography.fontSize.xs,
    fontStyle: 'italic',
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
  },
  uploadOptionDescription: {
    fontSize: theme.typography.fontSize.sm - 1,
    lineHeight: theme.typography.lineHeight.tight,
    letterSpacing: 0.16,
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
  },
  formFooterLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  formFooterLink: {
    // Empty style for Pressable wrapper
  },
  formFooterLinkText: {
    fontSize: theme.typography.fontSize.sm - 1,
    lineHeight: theme.typography.lineHeight.tight,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
  nextText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: 'bold',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
