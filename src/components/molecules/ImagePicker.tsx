import React from 'react';
import { Text, Pressable, Alert } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  MediaType,
  CameraOptions,
  ImageLibraryOptions } from 'react-native-image-picker';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import {
  validateImageFile,
  ImageValidationError } from '#utils/imageValidation';
import { useBottomSheetModal } from '#hooks/useBottomSheetModal';
import { usePermission } from '#hooks/permissions/usePermission';
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
  quality: 0.8 };

export const ImagePicker: React.FC<ImagePickerProps> = ({
  onImageSelected,
  onMultiImageSelected,
  multiSelect = false,
  onError,
  disabled = false,
  isProfile = false,
  children }) => {
  const { theme } = useUnistyles();
  const { ref: sheetRef, open: openSheet } = useBottomSheetModal();
  const { request: requestCamera, isBlocked, openSettings } = usePermission('camera');

  const handleImageResponse = (response: ImagePickerResponse) => {
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
            type: asset.type };
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
          type: asset.type };

        try {
          validateImageFile(imageFile, isProfile);
          onImageSelected(imageFile);
        } catch (error) {
          const validationError = error as ImageValidationError;
          onError?.(validationError);
          Alert.alert('Invalid Image', validationError.message);
        }
      }
    };

  const handleCameraPress = async () => {
    if (isBlocked) {
      Alert.alert(
        'Camera Permission',
        'Camera permission is required. Please enable it in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: openSettings },
        ],
      );
      return;
    }
    const result = await requestCamera();
    if (result === 'granted') {
      launchCamera(DEFAULT_OPTIONS, handleImageResponse);
    }
  };

  const handleLibraryPress = () => {
    const libraryOptions: ImageLibraryOptions = {
      ...DEFAULT_OPTIONS,
      ...(multiSelect && { selectionLimit: 0 }) };
    launchImageLibrary(libraryOptions, handleImageResponse);
  };

  const showImagePicker = () => {
    if (disabled) return;
    openSheet();
  };

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
        <Pressable onPress={showImagePicker} disabled={disabled} style={({pressed}) => pressed && styles.pressed}>
          {children}
        </Pressable>
        {renderSheet()}
      </>
    );
  }

  return (
    <>
      <Pressable
        style={({pressed}) => [styles.pickerButton, disabled && styles.pickerButtonDisabled, pressed && styles.pressed]}
        onPress={showImagePicker}
        disabled={disabled}
      >
        <Icon name="camera-outline" size={24} color={theme.colors.primary} />
        <Text style={styles.pickerButtonText}>Add Photo</Text>
      </Pressable>
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
    gap: theme.spacing.sm },
  pickerButtonDisabled: {
    opacity: theme.opacity.disabled,
    borderColor: theme.colors.border },
  pickerButtonText: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.primary },
  pressed: {
    opacity: theme.opacity.pressed } }));
