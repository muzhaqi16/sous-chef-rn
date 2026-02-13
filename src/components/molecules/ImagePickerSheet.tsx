import React, { useCallback, useMemo, forwardRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#/components/atoms/GlobalBottomSheetBackdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { Icon, IconLibrary } from '#utils/iconUtils';

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
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const animationConfigs = useSharedBottomSheetConfigs();

    const handleDismiss = useCallback(() => {
      if (ref && 'current' in ref) {
        ref.current?.dismiss();
      }
    }, [ref]);

    const options: ImagePickerOption[] = useMemo(
      () => [
        {
          key: 'camera',
          label: 'Take Photo',
          icon: 'camera',
          library: 'Feather' as IconLibrary,
          onPress: () => {
            handleDismiss();
            // Small delay to allow sheet to close before launching camera
            setTimeout(onCamera, 100);
          },
        },
        {
          key: 'library',
          label: 'Choose from Library',
          icon: 'image',
          library: 'Feather' as IconLibrary,
          onPress: () => {
            handleDismiss();
            setTimeout(onLibrary, 100);
          },
        },
      ],
      [handleDismiss, onCamera, onLibrary],
    );

    const renderBackdrop = useCallback(
      (props: any) => (
        <GlobalBottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        enablePanDownToClose
        animationConfigs={animationConfigs}
        backgroundStyle={{ backgroundColor: theme.colors.background }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
        backdropComponent={renderBackdrop}
        stackBehavior="push"
      >
        <BottomSheetView style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
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
    paddingTop: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  optionsContainer: {
    gap: theme.spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  cancelButton: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
}));
