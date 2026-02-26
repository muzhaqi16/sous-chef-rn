import React, { forwardRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { Icon, IconLibrary } from '#utils/iconUtils';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';

interface ImagePickerOption {
  key: string;
  label: string;
  icon: string;
  library?: IconLibrary;
  onPress: () => void;
}

interface ImagePickerSheetProps {
  onCamera: () => void;
  onLibrary: () => void;
}

export const ImagePickerSheet = forwardRef<BottomSheetModal, ImagePickerSheetProps>(
  ({ onCamera, onLibrary }, ref) => {
    const handleDismiss = () => {
      if (ref && 'current' in ref) {
        ref.current?.dismiss();
      }
    };

    const { modalProps, contentContainerStyle, theme } = useStandardBottomSheet({
      onDismiss: handleDismiss,
      snapPoints: [],
      enableDynamicSizing: true });

    const options: ImagePickerOption[] = [
        {
          key: 'camera',
          label: 'Take Photo',
          icon: 'camera',
          onPress: () => {
            handleDismiss();
            // Small delay to allow sheet to close before launching camera
            setTimeout(onCamera, 100);
          } },
        {
          key: 'library',
          label: 'Choose from Library',
          icon: 'image',
          onPress: () => {
            handleDismiss();
            setTimeout(onLibrary, 100);
          } },
      ];

    return (
      <BottomSheetModal
        ref={ref}
        {...modalProps}
        handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
        stackBehavior="push"
      >
        <BottomSheetView style={[styles.container, contentContainerStyle]}>
          <Text style={styles.title}>Add Photo</Text>
          <View style={styles.optionsContainer}>
            {options.map(option => (
              <Pressable
                key={option.key}
                style={({pressed}) => [styles.option, pressed && styles.pressed]}
                onPress={option.onPress}
              >
                <View style={styles.iconContainer}>
                  <Icon
                    name={option.icon}
                    size={24}
                    library={option.library}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={styles.optionLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={({pressed}) => [styles.cancelButton, pressed && styles.pressed]}
            onPress={handleDismiss}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

ImagePickerSheet.displayName = 'ImagePickerSheet';

const styles = StyleSheet.create(theme => ({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg },
  optionsContainer: {
    gap: theme.spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.md },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center' },
  optionLabel: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary },
  cancelButton: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center' },
  cancelText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary },
  pressed: {
    opacity: theme.opacity.pressed } }));
