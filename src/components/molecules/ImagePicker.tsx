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
import { Icon } from '#utils/iconUtils';
import {
  validateImageFile,
  ImageValidationError,
} from '#utils/imageValidation';
import { useBottomSheetModal } from '#hooks/useBottomSheetModal';
import { ImagePickerSheet } from './ImagePickerSheet';

export interface ImageFile {
  uri: string;
  fileName?: string;
  fileSize?: number;
  type?: string;
}

interface ImagePickerProps {
  onImageSelected: (image: ImageFile) => void;
  onMultiImageSelected?: (images: ImageFile[]) => void;
  multiSelect?: boolean;
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
  onMultiImageSelected,
  multiSelect = false,
  onError,
  disabled = false,
  isProfile = false,
  children,
}) => {
  const { theme } = useUnistyles();
  const { ref: sheetRef, open: openSheet } = useBottomSheetModal();

  const handleImageResponse = useCallback(
    (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorCode || !response.assets?.length) {
        return;
      }

      if (multiSelect && onMultiImageSelected) {
        // Multi-select mode: process all assets
        const validImages: ImageFile[] = [];
        for (const asset of response.assets) {
          if (!asset.uri) continue;
          const imageFile: ImageFile = {
            uri: asset.uri,
            fileName: asset.fileName,
            fileSize: asset.fileSize,
            type: asset.type,
          };
          try {
            validateImageFile(imageFile, isProfile);
            validImages.push(imageFile);
          } catch (error) {
            const validationError = error as ImageValidationError;
            onError?.(validationError);
          }
        }
        if (validImages.length > 0) {
          onMultiImageSelected(validImages);
        }
      } else {
        // Single-select mode (backward compatible)
        const asset = response.assets[0];
        if (!asset?.uri) return;
        const imageFile: ImageFile = {
          uri: asset.uri,
          fileName: asset.fileName,
          fileSize: asset.fileSize,
          type: asset.type,
        };

        try {
          validateImageFile(imageFile, isProfile);
          onImageSelected(imageFile);
        } catch (error) {
          const validationError = error as ImageValidationError;
          onError?.(validationError);
          Alert.alert('Invalid Image', validationError.message);
        }
      }
    },
    [onImageSelected, onMultiImageSelected, multiSelect, onError, isProfile],
  );

  // PERFORMANCE: Consolidated permission request logic
  const requestPermissionAndLaunch = useCallback(
    async (
      permission: any,
      launchFn: (
        options: CameraOptions | ImageLibraryOptions,
        callback: (response: ImagePickerResponse) => void,
      ) => void,
      permissionName: string,
      allowLaunchWithoutPermission: boolean = false,
    ) => {
      try {
        const result = await request(permission);

        if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) {
          launchFn(DEFAULT_OPTIONS, handleImageResponse);
        } else if (allowLaunchWithoutPermission) {
          // Modern iOS doesn't need permission for photo library
          launchFn(DEFAULT_OPTIONS, handleImageResponse);
        } else {
          Alert.alert(
            `${permissionName} Permission`,
            `${permissionName} permission is required. Please enable it in your device settings.`,
          );
        }
      } catch {
        // Fallback: try launching without permission check
        launchFn(DEFAULT_OPTIONS, handleImageResponse);
      }
    },
    [handleImageResponse],
  );

  const handleCameraPress = useCallback(() => {
    requestPermissionAndLaunch(
      PERMISSIONS.ANDROID.CAMERA || PERMISSIONS.IOS.CAMERA,
      launchCamera,
      'Camera',
      false,
    );
  }, [requestPermissionAndLaunch]);

  const handleLibraryPress = useCallback(() => {
    const libraryOptions: ImageLibraryOptions = {
      ...DEFAULT_OPTIONS,
      ...(multiSelect && { selectionLimit: 0 }),
    };
    launchImageLibrary(libraryOptions, handleImageResponse);
  }, [handleImageResponse, multiSelect]);

  const showImagePicker = useCallback(() => {
    if (disabled) return;
    openSheet();
  }, [disabled, openSheet]);

  const renderSheet = () => (
    <ImagePickerSheet
      ref={sheetRef}
      onCamera={handleCameraPress}
      onLibrary={handleLibraryPress}
    />
  );

  if (children) {
    return (
      <>
        <TouchableOpacity onPress={showImagePicker} disabled={disabled}>
          {children}
        </TouchableOpacity>
        {renderSheet()}
      </>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.pickerButton, disabled && styles.pickerButtonDisabled]}
        onPress={showImagePicker}
        disabled={disabled}
      >
        <Icon name="add-a-photo" size={24} color={theme.colors.primary} />
        <Text style={styles.pickerButtonText}>Add Photo</Text>
      </TouchableOpacity>
      {renderSheet()}
    </>
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
