import React, { useRef } from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  BottomSheetModal,
  useStandardBottomSheet,
} from '#hooks/useStandardBottomSheet';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

const VariantBottomSheetModal = withUnistyles(BottomSheetModal, theme => ({
  backgroundStyle: { backgroundColor: theme.colors.surfaceVariant },
}));

interface ImagePickerSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onCamera: () => void;
  onLibrary: () => void;
}

export const ImagePickerSheet: React.FC<ImagePickerSheetProps> = ({
  visible,
  onDismiss,
  onCamera,
  onLibrary,
}) => {
  const pendingActionRef = useRef<(() => void) | null>(null);

  const { ref, modalProps, contentContainerStyle, dismiss } =
    useStandardBottomSheet({
      visible,
      onDismiss: () => {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        onDismiss();
        action?.();
      },
      snapPoints: [],
      enableDynamicSizing: true,
    });

  const handleCamera = () => {
    pendingActionRef.current = onCamera;
    dismiss();
  };

  const handleLibrary = () => {
    pendingActionRef.current = onLibrary;
    dismiss();
  };

  return (
    <VariantBottomSheetModal ref={ref} {...modalProps} stackBehavior="push">
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
          onPress={dismiss}
        >
          <Text size="md" weight="medium" tone="secondary">
            Cancel
          </Text>
        </Pressable>
      </BottomSheetView>
    </VariantBottomSheetModal>
  );
};

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
