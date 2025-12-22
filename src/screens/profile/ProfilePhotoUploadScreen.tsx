import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { useSafeNavigation } from '#hooks';
import { Icon } from '#utils';
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
import { useImageUpload } from '#hooks';
import { ImageFile } from '#components/molecules/ImagePicker';
import { storage } from '#/storage/mmkv';
import { ImageUploadPurpose } from '#generated';

type RootStackParamList = {
  ProfilePhotoUpload: undefined;
  ImageCrop: {
    imageFile: ImageFile;
  };
};

type ProfilePhotoUploadRouteProp = RouteProp<
  RootStackParamList,
  'ProfilePhotoUpload'
>;

const DEFAULT_OPTIONS: CameraOptions | ImageLibraryOptions = {
  mediaType: 'photo' as MediaType,
  includeBase64: false,
  maxHeight: 2000,
  maxWidth: 2000,
  quality: 0.8,
};

const { width: screenWidth } = Dimensions.get('window');
const AVATAR_SIZE = Math.min(screenWidth * 0.6, 250);

export const ProfilePhotoUploadScreen: React.FC<{
  route: ProfilePhotoUploadRouteProp;
}> = () => {
  const { navigation, goBack } = useSafeNavigation();
  const { theme } = useUnistyles();
  const { uploadProfileImage, updateProfileAvatarUrl } = useImageUpload();

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
          storage.remove('temp_cropped_image');
        }
      } catch (error) {
        console.error('Error reading cropped image from MMKV:', error);
        // Clean up potentially corrupted data
        storage.remove('temp_cropped_image');
      }
    }, []),
  );

  // Clean up MMKV on unmount
  useEffect(() => {
    return () => {
      storage.remove('temp_cropped_image');
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
      } else if (result === RESULTS.DENIED) {
        // PERFORMANCE: Specific error message - permission denied
        Alert.alert(
          'Camera Permission Denied',
          'Camera permission is required to take photos. Please enable it in your device settings.',
        );
      } else if (result === RESULTS.BLOCKED) {
        // PERFORMANCE: Specific error message - permission permanently blocked
        Alert.alert(
          'Camera Permission Blocked',
          'Camera access is blocked. Please go to Settings > Apps > Sous Chef > Permissions to enable camera access.',
        );
      } else {
        // PERFORMANCE: Specific error message - other permission states
        Alert.alert(
          'Camera Permission',
          'Camera permission is required to take photos. Please enable it in your device settings.',
        );
      }
    } catch (error) {
      console.error('Camera permission error:', error);
      // PERFORMANCE: Specific error message - permission request failed
      Alert.alert(
        'Permission Error',
        'Failed to request camera permission. Please try again or check your device settings.',
      );
    }
  }, [handleImageResponse]);

  const handleSelectPhoto = useCallback(() => {
    // Android Photo Picker doesn't require permissions
    // iOS also allows launching without explicit permission on modern versions
    launchImageLibrary(DEFAULT_OPTIONS, handleImageResponse);
  }, [handleImageResponse]);

  const handleCropImage = useCallback(() => {
    if (!selectedImage) return;

    navigation.navigate('ImageCrop' as any, {
      imageFile: selectedImage,
    });
  }, [selectedImage, navigation]);

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
        goBack();
      }
    } catch (error) {
      Alert.alert('Upload Failed', 'Failed to update profile photo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetake = () => {
    setSelectedImage(null);
    setCroppedImage(null);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={goBack}
            style={styles.headerBack}
            disabled={isUploading}
          >
            <Icon
              color={theme.colors.textPrimary}
              name="chevron-left"
              size={30}
              library="Feather"
            />
          </TouchableOpacity>
          <Text style={styles.title}>Upload Your Photo</Text>
        </View>

        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
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
                name="user"
                size={100}
                library="Feather"
              />
            )}
          </View>

          {/* Show crop icon below image if not cropped yet */}
          {selectedImage && !croppedImage && (
            <TouchableOpacity
              onPress={handleCropImage}
              style={[
                styles.cropIconButton,
                { backgroundColor: theme.colors.primary },
              ]}
              disabled={isUploading}
            >
              <Icon
                color={theme.colors.background}
                name="crop"
                size={20}
                library="Feather"
              />
            </TouchableOpacity>
          )}
        </View>

        {selectedImage ? (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleUpload}
              style={[styles.btn, { backgroundColor: theme.colors.primary }]}
              disabled={isUploading}
            >
              <Text
                style={[styles.btnText, { color: theme.colors.background }]}
              >
                {isUploading ? 'Uploading...' : 'Upload Photo'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRetake}
              style={[
                styles.btnSecondary,
                { borderColor: theme.colors.primary },
              ]}
              disabled={isUploading}
            >
              <Text
                style={[
                  styles.btnSecondaryText,
                  { color: theme.colors.primary },
                ]}
              >
                Choose Different Photo
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleTakePhoto}
              style={[styles.btn, { backgroundColor: theme.colors.primary }]}
              disabled={isUploading}
            >
              <Text
                style={[styles.btnText, { color: theme.colors.background }]}
              >
                Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSelectPhoto}
              style={[
                styles.btnSecondary,
                { borderColor: theme.colors.primary },
              ]}
              disabled={isUploading}
            >
              <Text style={styles.btnSecondaryText}>Select Photo</Text>
            </TouchableOpacity>
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
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: '700',
    marginBottom: theme.spacing.xs + 2,
    textAlign: 'center',
    flex: 1,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '500',
    textAlign: 'center',
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
  btnText: {
    fontSize: theme.typography.fontSize.lg,
    lineHeight: theme.typography.lineHeight.relaxed,
    fontWeight: '600',
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
    fontSize: theme.typography.fontSize.lg,
    lineHeight: theme.typography.lineHeight.relaxed,
    fontWeight: '600',
    color: theme.colors.secondary,
  },
}));
