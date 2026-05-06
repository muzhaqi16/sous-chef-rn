import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Text } from '#components/atoms/Text';

interface ImagePickerSheetProps {
  onCamera: () => void;
  onLibrary: () => void;
}

export const ImagePickerSheet = forwardRef<
  BottomSheetModal,
  ImagePickerSheetProps
>(({ onCamera, onLibrary }, ref) => {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current!, []);

  // Pending action to execute after sheet dismisses
  const pendingActionRef = useRef<(() => void) | null>(null);

  const handleDismiss = () => {
    localRef.current?.dismiss();
  };

  const { modalProps, contentContainerStyle, theme } = useStandardBottomSheet({
    onDismiss: () => {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      action?.();
    },
    snapPoints: [],
    enableDynamicSizing: true,
  });

  const handleCamera = () => {
    pendingActionRef.current = onCamera;
    handleDismiss();
  };

  const handleLibrary = () => {
    pendingActionRef.current = onLibrary;
    handleDismiss();
  };

  return (
    <BottomSheetModal
      ref={localRef}
      {...modalProps}
      backgroundStyle={{ backgroundColor: theme.colors.surfaceVariant }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      stackBehavior="push"
    >
      <BottomSheetView style={[styles.container, contentContainerStyle]}>
        <Text size="lg" weight="bold" align="center" style={styles.title}>
          Add Photo
        </Text>
        <View style={styles.optionsContainer}>
          <Pressable
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            onPress={handleCamera}
          >
            <View style={styles.iconContainer}>
              <Icon name="camera" size={24} tone="primary" />
            </View>
            <Text size="md" weight="medium">
              Take Photo
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            onPress={handleLibrary}
          >
            <View style={styles.iconContainer}>
              <Icon name="image" size={24} tone="primary" />
            </View>
            <Text size="md" weight="medium">
              Choose from Library
            </Text>
          </Pressable>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.pressed,
          ]}
          onPress={handleDismiss}
        >
          <Text size="md" weight="medium" tone="secondary">
            Cancel
          </Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

ImagePickerSheet.displayName = 'ImagePickerSheet';

const styles = StyleSheet.create(theme => ({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  title: {
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
  cancelButton: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
