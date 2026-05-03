import React, { useState, useEffect } from 'react';
import { View, Image, Dimensions, Platform } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { alertService } from '#/services/alertService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { useSafeNavigation } from '#hooks/navigation/useSafeNavigation';
import { Icon } from '#utils/iconUtils';
import { BackButton } from '#components/atoms/BackButton';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  MediaType,
  CameraOptions,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
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
      'Camera Permission Denied',
      'Camera permission is required to take photos. Please enable it in your device settings.',
    );
  } else if (result === RESULTS.BLOCKED) {
    alertService.alert(
      'Camera Permission Blocked',
      'Camera access is blocked. Please go to Settings > Apps > Sous Chef > Permissions to enable camera access.',
    );
  } else {
    alertService.alert(
      'Camera Permission',
      'Camera permission is required to take photos. Please enable it in your device settings.',
    );
  }
}

export const ProfilePhotoUploadScreen: React.FC = () => {
  const { navigation, goBack } = useSafeNavigation();
  const { theme } = useUnistyles();
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
      alertService.alert('Invalid Image', validationError.message);
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
          'Permission Error',
          'Failed to request camera permission. Please try again or check your device settings.',
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

    navigation.dispatch(
      CommonActions.navigate('ImageCrop', { imageFile: selectedImage }),
    );
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
          // Update the profile avatar URL in the database
          await updateProfileAvatarUrl(imageUrl);
          goBack();
        }
      },
      setIsUploading,
      () => {
        alertService.alert('Upload Failed', 'Failed to update profile photo');
      },
    );
  };

  const handleRetake = () => {
    setSelectedImage(null);
    setCroppedImage(null);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right']}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <BackButton
            onPress={goBack}
            style={styles.headerBack}
            color={theme.colors.textPrimary}
            disabled={isUploading}
          />
          <Text size="3xl" weight="bold" align="center" style={styles.title}>
            Upload Your Photo
          </Text>
        </View>

        <Text size="base" weight="medium" align="center" tone="secondary">
          {croppedImage
            ? 'Photo cropped and ready to upload!'
            : selectedImage
            ? 'Tap the crop icon below to adjust your photo.'
            : 'Choose a profile picture to personalize your account.'}
        </Text>

        <View style={styles.avatar}>
          <View
            style={[
              styles.avatarPreview,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.primary,
              },
            ]}
          >
            {croppedImage || selectedImage ? (
              <Image
                source={{ uri: croppedImage?.uri || selectedImage?.uri }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <Icon
                color={theme.colors.textSecondary}
                name="person"
                size={100}
              />
            )}
          </View>

          {/* Show crop icon below image if not cropped yet */}
          {!!selectedImage && !croppedImage && (
            <Pressable
              onPress={handleCropImage}
              style={({ pressed }) => [
                styles.cropIconButton,
                { backgroundColor: theme.colors.primary },
                pressed && styles.pressed,
              ]}
              disabled={isUploading}
            >
              <Icon color={theme.colors.background} name="crop" size={20} />
            </Pressable>
          )}
        </View>

        {selectedImage ? (
          <View style={styles.buttonContainer}>
            <Pressable
              onPress={handleUpload}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: theme.colors.primary },
                pressed && styles.pressed,
              ]}
              disabled={isUploading}
            >
              <Text
                size="lg"
                lineHeight="relaxed"
                weight="semibold"
                style={{ color: theme.colors.background }}
              >
                {isUploading ? 'Uploading...' : 'Upload Photo'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleRetake}
              style={({ pressed }) => [
                styles.btnSecondary,
                { borderColor: theme.colors.primary },
                pressed && styles.pressed,
              ]}
              disabled={isUploading}
            >
              <Text
                size="lg"
                lineHeight="relaxed"
                weight="semibold"
                tone="accent"
                style={styles.btnSecondaryText}
              >
                Choose Different Photo
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.buttonContainer}>
            <Pressable
              onPress={handleTakePhoto}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: theme.colors.primary },
                pressed && styles.pressed,
              ]}
              disabled={isUploading}
            >
              <Text
                size="lg"
                lineHeight="relaxed"
                weight="semibold"
                style={{ color: theme.colors.background }}
              >
                Take Photo
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSelectPhoto}
              style={({ pressed }) => [
                styles.btnSecondary,
                { borderColor: theme.colors.primary },
                pressed && styles.pressed,
              ]}
              disabled={isUploading}
            >
              <Text
                size="lg"
                lineHeight="relaxed"
                weight="semibold"
                style={styles.btnSecondaryText}
              >
                Select Photo
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
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
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_SIZE / 2,
  },
  cropIconButton: {
    marginTop: theme.spacing.md,
    width: 48,
    height: 48,
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  btnSecondaryText: {
    color: theme.colors.secondary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default ProfilePhotoUploadScreen;
