import React, { useState } from 'react';
import { useTranslation } from '#/i18n';

import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  MediaType,
  CameraOptions,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { imageErrorMessage } from '#hooks/useImageUpload';
import {
  validateImageFile,
  ImageValidationError,
} from '#utils/imageValidation';
import { usePermission } from '#hooks/permissions/usePermission';
import { ImagePickerSheet } from './ImagePickerSheet';
import { Text } from '#components/atoms/Text';

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

/** Module-level validation wrapper to keep try-catch out of the component body (React Compiler). */
function tryValidateImage(
  imageFile: ImageFile,
  isProfile: boolean,
): { valid: true } | { valid: false; error: ImageValidationError } {
  try {
    validateImageFile(imageFile, isProfile);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error as ImageValidationError };
  }
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
  const { t } = useTranslation();
  const [sheetVisible, setSheetVisible] = useState(false);
  const {
    request: requestCamera,
    isBlocked,
    openSettings,
  } = usePermission('camera');

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
          type: asset.type,
        };
        const result = tryValidateImage(imageFile, isProfile);
        if (result.valid) {
          validImages.push(imageFile);
        } else {
          onError?.(result.error);
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

      const result = tryValidateImage(imageFile, isProfile);
      if (result.valid) {
        onImageSelected(imageFile);
      } else {
        onError?.(result.error);
        // The error's own message is English by construction and belongs in the
        // report `onError` makes, not on screen. The code is what maps to copy.
        alertService.alert(
          t('labels.invalidImage'),
          imageErrorMessage(t, result.error, isProfile),
        );
      }
    }
  };

  const handleCameraPress = async () => {
    if (isBlocked) {
      alertService.alert(
        t('labels.cameraPermission'),
        t('imagePicker.cameraPermissionBody'),
        [
          { text: t('labels.cancel'), style: 'cancel' },
          { text: t('labels.openSettings'), onPress: openSettings },
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
      ...(multiSelect && { selectionLimit: 0 }),
    };
    launchImageLibrary(libraryOptions, handleImageResponse);
  };

  const showImagePicker = () => {
    if (disabled) return;
    setSheetVisible(true);
  };

  const hideSheet = () => setSheetVisible(false);

  const renderSheet = () => (
    <ImagePickerSheet
      visible={sheetVisible}
      onDismiss={hideSheet}
      onCamera={handleCameraPress}
      onLibrary={handleLibraryPress}
    />
  );

  if (children) {
    return (
      <>
        <Pressable
          onPress={showImagePicker}
          disabled={disabled}
          style={({ pressed }) => pressed && styles.pressed}
        >
          {children}
        </Pressable>
        {renderSheet()}
      </>
    );
  }

  return (
    <>
      <AppPressable
        style={[styles.pickerButton, disabled && styles.pickerButtonDisabled]}
        onPress={showImagePicker}
        disabled={disabled}
      >
        <Icon name="camera-outline" size={24} tone="primary" />
        <Text size="base" weight="medium" tone="accent">
          {t('imagePicker.addPhoto')}
        </Text>
      </AppPressable>
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
    borderCurve: 'continuous',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  pickerButtonDisabled: {
    opacity: theme.opacity.disabled,
    borderColor: theme.colors.border,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
