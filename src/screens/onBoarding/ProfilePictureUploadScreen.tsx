import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { OnBoardingWrapper } from '#components/templates';
import { Button } from '#components';
import { Icon } from '#utils';
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
import { useImageUpload, useOnboardingNavigation } from '#hooks';
import { ImageFile } from '#components/molecules/ImagePicker';
import { storage } from '#/storage/mmkv';
import { ImageUploadPurpose } from '#generated';
import { useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '#hooks';

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
  const { navigateTo } = useAppNavigation();
  const { theme } = useUnistyles();
  const { uploadProfileImage, updateProfileAvatarUrl } = useImageUpload();
  const { navigateToNextStep, navigateToPreviousStep, skipToStep } =
    useOnboardingNavigation();

  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [croppedImage, setCroppedImage] = useState<ImageFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Check for cropped image from MMKV when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      try {
        const storedCroppedImage = storage.getString('temp_cropped_image');
        if (storedCroppedImage) {
          const croppedImageFile: ImageFile = JSON.parse(storedCroppedImage);

          setCroppedImage(croppedImageFile);

          // Clean up the temporary storage
          storage.delete('temp_cropped_image');
        }
      } catch (error) {
        console.error('Error reading cropped image from MMKV:', error);
        // Clean up potentially corrupted data
        storage.delete('temp_cropped_image');
      }
    }, []),
  );

  // Clean up MMKV on unmount
  useEffect(() => {
    return () => {
      storage.delete('temp_cropped_image');
    };
  }, []);

  const handleImageResponse = useCallback((response: ImagePickerResponse) => {
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
      Alert.alert('Invalid Image', validationError.message);
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    try {
      const result = await request(
        PERMISSIONS.ANDROID.CAMERA || PERMISSIONS.IOS.CAMERA,
      );
      if (result === RESULTS.GRANTED) {
        launchCamera(DEFAULT_OPTIONS, handleImageResponse);
      } else {
        Alert.alert(
          'Camera Permission',
          'Camera permission is required to take photos. Please enable it in your device settings.',
        );
      }
    } catch (error) {
      launchCamera(DEFAULT_OPTIONS, handleImageResponse);
    }
  }, [handleImageResponse]);

  const handleSelectPhoto = useCallback(async () => {
    try {
      const result = await request(
        PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE ||
          PERMISSIONS.IOS.PHOTO_LIBRARY,
      );
      if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) {
        launchImageLibrary(DEFAULT_OPTIONS, handleImageResponse);
      } else {
        launchImageLibrary(DEFAULT_OPTIONS, handleImageResponse);
      }
    } catch (error) {
      launchImageLibrary(DEFAULT_OPTIONS, handleImageResponse);
    }
  }, [handleImageResponse]);

  const handleCropImage = useCallback(() => {
    if (!selectedImage) return;

    navigateTo.imageCrop({
      imageFile: selectedImage,
    });
  }, [selectedImage, navigateTo]);

  const handleUpload = async () => {
    const imageToUpload = croppedImage || selectedImage;
    if (!imageToUpload) return;

    setIsUploading(true);

    try {
      const imageUrl = await uploadProfileImage(
        imageToUpload,
        ImageUploadPurpose.ProfileAvatar,
        {
          onError: (error: Error) => {
            Alert.alert('Upload Failed', error.message);
          },
        },
      );

      if (imageUrl) {
        // Update the profile avatar URL in the database
        await updateProfileAvatarUrl(imageUrl);
        navigateToNextStep('ProfilePictureUpload');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      Alert.alert('Upload Failed', 'Failed to update profile photo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setCroppedImage(null);
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
      <View style={styles.container}>
        <View style={styles.avatarPreview}>
          {croppedImage || selectedImage ? (
            <>
              <Image
                alt="Profile preview"
                source={{ uri: croppedImage?.uri || selectedImage?.uri }}
                style={styles.avatarImage}
              />
              <TouchableOpacity
                onPress={handleRemoveImage}
                style={styles.avatarRemove}
                disabled={isUploading}
              >
                <Icon
                  library="Ionicons"
                  color={theme.colors.error}
                  name="close-circle"
                  size={24}
                />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon
                library="Ionicons"
                color={theme.colors.textSecondary}
                name="person"
                size={52}
              />
            </View>
          )}
        </View>

        {selectedImage && !croppedImage && (
          <View style={styles.cropContainer}>
            <TouchableOpacity
              onPress={handleCropImage}
              style={[
                styles.cropButton,
                { backgroundColor: theme.colors.primary },
              ]}
              disabled={isUploading}
            >
              <Text
                style={[styles.cropButtonText, { color: theme.colors.white }]}
              >
                Crop & Center
              </Text>
            </TouchableOpacity>
            <Text
              style={[styles.cropHint, { color: theme.colors.textSecondary }]}
            >
              Recommended to optimize your photo
            </Text>
          </View>
        )}

        {!selectedImage && (
          <View style={styles.formAction}>
            <TouchableOpacity
              onPress={handleSelectPhoto}
              style={styles.uploadOption}
              disabled={isUploading}
            >
              <View style={styles.uploadOptionIcon}>
                <Icon
                  library="Ionicons"
                  color={theme.colors.primary}
                  name="images"
                  size={24}
                />
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
                library="Ionicons"
                color={theme.colors.textSecondary}
                name="chevron-forward"
                size={20}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTakePhoto}
              style={styles.uploadOption}
              disabled={isUploading}
            >
              <View style={styles.uploadOptionIcon}>
                <Icon
                  library="Ionicons"
                  color={theme.colors.primary}
                  name="camera"
                  size={24}
                />
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
                library="Ionicons"
                color={theme.colors.textSecondary}
                name="chevron-forward"
                size={20}
              />
            </TouchableOpacity>
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
            <TouchableOpacity
              onPress={() => {
                // handle onPress
              }}
              style={styles.formFooterLink}
            >
              <Text
                style={[
                  styles.formFooterLinkText,
                  { color: theme.colors.primary },
                ]}
              >
                Terms of Service
              </Text>
            </TouchableOpacity>

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

            <TouchableOpacity
              onPress={() => {
                // handle onPress
              }}
              style={styles.formFooterLink}
            >
              <Text
                style={[
                  styles.formFooterLinkText,
                  { color: theme.colors.primary },
                ]}
              >
                Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Button
        title={isUploading ? 'Uploading...' : 'Upload & Continue'}
        onPress={!croppedImage || !selectedImage ? handleUpload : () => {}}
        btnStyle={[
          styles.nextButton,
          { backgroundColor: theme.colors.primary },
        ]}
        txtStyle={[styles.nextText, { color: theme.colors.white }]}
        disabled={!selectedImage || isUploading}
      />
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  avatarPreview: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    marginTop: 24,
    marginBottom: 32,
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
    borderRadius: 12,
    padding: 0,
  },
  cropContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  cropButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  cropButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cropHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  formAction: {
    marginVertical: 24,
    gap: 12,
  },
  uploadOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  uploadOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  uploadOptionContent: {
    flex: 1,
  },
  uploadOptionLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  uploadOptionDescription: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.16,
  },
  formFooter: {
    marginTop: 'auto',
    marginBottom: 24,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    textAlign: 'center',
    alignItems: 'center',
  },
  formFooterText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  formFooterLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    gap: 4,
  },
  formFooterLink: {
    // Empty style for TouchableOpacity wrapper
  },
  formFooterLinkText: {
    fontSize: 13,
    lineHeight: 18,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
  nextButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  nextText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
}));
