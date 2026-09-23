import React, { useState } from 'react';
import { useTranslation } from '#/i18n';

import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { usePhotoCapture } from '#hooks/usePhotoCapture';
import { ImagePickerSheet } from '#features/catalog/components/ImagePickerSheet';
import { Text } from '#components/atoms/Text';
import type { ImageFile } from '#/types/media';

interface ImagePickerProps {
  onImageSelected: (image: ImageFile) => void;
  onMultiImageSelected?: (images: ImageFile[]) => void;
  multiSelect?: boolean;
  onError?: (error: Error) => void;
  disabled?: boolean;
  isProfile?: boolean; // For different validation rules
  children?: React.ReactNode;
}

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
  const { takePhoto, pickPhoto } = usePhotoCapture({
    forProfile: isProfile,
    multiple: multiSelect && !!onMultiImageSelected,
    onInvalid: onError,
  });

  const deliver = (images: ImageFile[]) => {
    const [first] = images;
    if (!first) return;
    if (multiSelect && onMultiImageSelected) {
      onMultiImageSelected(images);
    } else {
      onImageSelected(first);
    }
  };

  const handleCameraPress = async () => deliver(await takePhoto());
  const handleLibraryPress = async () => deliver(await pickPhoto());

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
          accessibilityLabel={t('a11y.choosePhoto')}
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
        <Text role="bodyStrong" tone="accent">
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
    borderWidth: theme.borderWidth.medium,
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
