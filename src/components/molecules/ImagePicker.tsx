import React, { useCallback } from 'react';
import { Text, TouchableOpacity, Alert } from 'react-native';
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
import { Icon } from '#utils';
import {
  validateImageFile,
  ImageValidationError,
} from '#utils/imageValidation';

export interface ImageFile {
  uri: string;
  fileName?: string;
  fileSize?: number;
  type?: string;
}

interface ImagePickerProps {
  onImageSelected: (image: ImageFile) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  isProfile?: boolean; // For different validation rules
  children?: React.ReactNode;
}

const DEFAULT_OPTIONS: CameraOptions | ImageLibraryOptions = {
  mediaType: 'photo' as MediaType,
  includeBase64: false,
  maxHeight: 2000,
  maxWidth: 2000,
  quality: 0.8,
};

export const ImagePicker: React.FC<ImagePickerProps> = ({
  onImageSelected,
  onError,
  disabled = false,
  isProfile = false,
  children,
}) => {
  const { theme } = useUnistyles();

  const handleImageResponse = useCallback(
    (response: ImagePickerResponse) => {
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
        // Validate the selected image
        validateImageFile(imageFile, isProfile);
        onImageSelected(imageFile);
      } catch (error) {
        const validationError = error as ImageValidationError;
        onError?.(validationError);
        Alert.alert('Invalid Image', validationError.message);
      }
    },
    [onImageSelected, onError, isProfile],
  );

  const showImagePicker = useCallback(() => {
    if (disabled) return;

    Alert.alert(
      'Select Image',
      'Choose how you want to add an image',
      [
        {
          text: 'Camera',
          onPress: async () => {
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
              // Fallback: try launching without permission check
              launchCamera(DEFAULT_OPTIONS, handleImageResponse);
            }
          },
          style: 'default',
        },
        {
          text: 'Photo Library',
          onPress: async () => {
            try {
              const result = await request(
                PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE ||
                  PERMISSIONS.IOS.PHOTO_LIBRARY,
              );
              if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) {
                launchImageLibrary(DEFAULT_OPTIONS, handleImageResponse);
              } else {
                // Try anyway - modern iOS doesn't need permission for photo library
                launchImageLibrary(DEFAULT_OPTIONS, handleImageResponse);
              }
            } catch (error) {
              // Fallback: try launching without permission check
              launchImageLibrary(DEFAULT_OPTIONS, handleImageResponse);
            }
          },
          style: 'default',
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true },
    );
  }, [disabled, handleImageResponse]);

  if (children) {
    return (
      <TouchableOpacity onPress={showImagePicker} disabled={disabled}>
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.pickerButton, disabled && styles.pickerButtonDisabled]}
      onPress={showImagePicker}
      disabled={disabled}
    >
      <Icon name="add-a-photo" size={24} color={theme.colors.primary} />
      <Text style={styles.pickerButtonText}>Add Photo</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  pickerButtonDisabled: {
    opacity: 0.5,
    borderColor: theme.colors.border,
  },
  pickerButtonText: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.primary,
  },
}));
