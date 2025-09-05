import React, {useState, useCallback, useEffect} from 'react';
import {
  SafeAreaView,
  View,
  TouchableOpacity,
  Text,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import {useRoute, RouteProp, useFocusEffect} from '@react-navigation/native';
import {useSafeNavigation} from '#hooks';
import {Icon} from '#utils';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  MediaType,
  CameraOptions,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import {request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {validateImageFile, ImageValidationError} from '#utils/imageValidation';
import {useImageUpload} from '#hooks';
import {ImageFile} from '#components/molecules/ImagePicker';
import {storage} from '#/storage/mmkv';

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

const {width: screenWidth} = Dimensions.get('window');
const AVATAR_SIZE = Math.min(screenWidth * 0.6, 250);

export const ProfilePhotoUploadScreen = () => {
  const {navigation, goBack} = useSafeNavigation();
  const route = useRoute<ProfilePhotoUploadRouteProp>();
  const {theme} = useUnistyles();
  const {uploadProfileImage, updateProfileAvatarUrl} = useImageUpload();

  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [croppedImage, setCroppedImage] = useState<ImageFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Check for cropped image from MMKV when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Screen focused, checking MMKV for cropped image...');

      try {
        const storedCroppedImage = storage.getString('temp_cropped_image');
        if (storedCroppedImage) {
          const croppedImageFile: ImageFile = JSON.parse(storedCroppedImage);
          console.log('Found cropped image in MMKV:', croppedImageFile.uri);

          setCroppedImage(croppedImageFile);

          // Clean up the temporary storage
          storage.delete('temp_cropped_image');
          console.log('Cleaned up temporary cropped image from MMKV');
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
      console.log('Cleaning up temporary MMKV data');
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

    console.log('Navigating to crop with image:', selectedImage.uri);
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
        'PROFILE_AVATAR',
        {
          onProgress: (progress: number) => {
            console.log('Upload progress:', progress);
          },
          onSuccess: (url: string) => {
            console.log('Upload successful:', url);
          },
          onError: (error: Error) => {
            Alert.alert('Upload Failed', error.message);
          },
        },
      );

      if (imageUrl) {
        console.log('Profile image uploaded:', imageUrl);
        // Update the profile avatar URL in the database
        await updateProfileAvatarUrl(imageUrl);
        goBack();
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      Alert.alert('Upload Failed', 'Failed to update profile photo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSkip = () => {
    goBack();
  };

  const handleRetake = () => {
    setSelectedImage(null);
    setCroppedImage(null);
  };

  // Debug logging
  useEffect(() => {
    console.log(
      'State update - selectedImage:',
      !!selectedImage,
      'croppedImage:',
      !!croppedImage,
    );
  }, [selectedImage, croppedImage]);

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={goBack}
            style={styles.headerBack}
            disabled={isUploading}>
            <Icon
              color={theme.colors.textPrimary}
              name="chevron-left"
              size={30}
              library="Feather"
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} disabled={isUploading}>
            <Text
              style={[styles.headerSkip, {color: theme.colors.textPrimary}]}>
              Skip
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, {color: theme.colors.textPrimary}]}>
          Upload Your Photo
        </Text>

        <Text style={[styles.subtitle, {color: theme.colors.textSecondary}]}>
          {croppedImage
            ? 'Photo cropped and ready to upload!'
            : selectedImage
              ? 'Tap "Crop & Center" to optimize your photo.'
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
            ]}>
            {croppedImage || selectedImage ? (
              <Image
                source={{uri: croppedImage?.uri || selectedImage?.uri}}
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

          {/* Debug info - remove this in production */}
          {__DEV__ && (
            <Text
              style={{
                fontSize: 10,
                marginTop: 8,
                color: theme.colors.textSecondary,
              }}>
              Selected: {selectedImage ? '✓' : '✗'} | Cropped:{' '}
              {croppedImage ? '✓' : '✗'}
            </Text>
          )}
        </View>

        {selectedImage ? (
          <View style={styles.buttonContainer}>
            {!croppedImage ? (
              // Show crop button when image is selected but not cropped yet
              <TouchableOpacity
                onPress={handleCropImage}
                style={[styles.btn, {backgroundColor: theme.colors.primary}]}
                disabled={false}>
                <Text
                  style={[styles.btnText, {color: theme.colors.background}]}>
                  Crop & Center
                </Text>
              </TouchableOpacity>
            ) : (
              // Show upload button when image is cropped and ready
              <TouchableOpacity
                onPress={handleUpload}
                style={[styles.btn, {backgroundColor: theme.colors.primary}]}
                disabled={isUploading}>
                <Text
                  style={[styles.btnText, {color: theme.colors.background}]}>
                  {isUploading ? 'Uploading...' : 'Upload Photo'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleRetake}
              style={[styles.btnSecondary, {borderColor: theme.colors.primary}]}
              disabled={isUploading}>
              <Text
                style={[
                  styles.btnSecondaryText,
                  {color: theme.colors.primary},
                ]}>
                Choose Different Photo
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleTakePhoto}
              style={[styles.btn, {backgroundColor: theme.colors.primary}]}
              disabled={isUploading}>
              <Text style={[styles.btnText, {color: theme.colors.background}]}>
                Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSelectPhoto}
              style={[styles.btnSecondary, {borderColor: theme.colors.primary}]}
              disabled={isUploading}>
              <Text
                style={[
                  styles.btnSecondaryText,
                  {color: theme.colors.primary},
                ]}>
                Select Photo
              </Text>
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
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 31,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 8,
  },
  headerBack: {
    padding: 8,
    paddingTop: 0,
    position: 'relative',
    marginLeft: -16,
  },
  headerSkip: {
    fontSize: 15,
    fontWeight: '600',
  },
  avatar: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    alignItems: 'center',
    marginBottom: 'auto',
    padding: 24,
  },
  avatarPreview: {
    marginTop: 48,
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
  buttonContainer: {
    gap: 12,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  btnText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  btnSecondaryText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
  },
}));
