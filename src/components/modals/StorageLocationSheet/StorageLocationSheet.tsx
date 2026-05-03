import React, { useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import {
  StorageLocationForm,
  type StorageLocationFormRef,
} from '#components/organisms/storageLocation/StorageLocationForm';
import { Text } from '#components/atoms/Text';

interface StorageLocationData {
  name: string;
  type: string;
  parentLocationId?: string;
  description?: string | null;
  temperature?: string | null;
  color?: string | null;
  isClimateControlled?: boolean | null;
  capacity?: number | null;
  capacityUnit?: string | null;
  isDefault?: boolean | null;
}

import { StorageLocation } from '#/graphql/generated/schemaTypes';

interface StorageLocationSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: StorageLocationData) => Promise<boolean | void>;
  initialData?: StorageLocation | null;
  availableLocations: Array<{ id: string; name: string; type: string }>;
  isSubmitting?: boolean;
}

export const StorageLocationSheet: React.FC<StorageLocationSheetProps> = ({
  visible,
  onClose,
  onSubmit,
  initialData,
  availableLocations,
  isSubmitting = false,
}) => {
  const { ref, modalProps, contentContainerStyle, theme } =
    useStandardBottomSheet({
      visible,
      onDismiss: onClose,
      snapPoints: ['80%', '95%'],
    });
  const formRef = useRef<StorageLocationFormRef>(null);

  const handleSubmit = async (data: StorageLocationData) => {
    const result = await onSubmit(data);
    if (result !== false) {
      onClose();
    }
  };

  const handleHeaderSave = () => {
    formRef.current?.submit();
  };

  const isEditing = !!initialData;
  const title = isEditing ? 'Edit Storage Location' : 'Add Storage Location';
  const saveText = isEditing ? 'Update' : 'Create';

  return (
    <BottomSheetModal ref={ref} {...modalProps} index={0}>
      <BottomSheetScrollView
        style={styles.content}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            disabled={isSubmitting}
          >
            <Text size="md" tone="secondary">
              Cancel
            </Text>
          </Pressable>

          <Text size="lg" weight="semibold" align="center" style={styles.title}>
            {title}
          </Text>

          <Pressable
            onPress={handleHeaderSave}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={saveText}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Text size="md" weight="semibold" align="right" tone="accent">
                {saveText}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Divider */}
        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />

        {/* Form */}
        <StorageLocationForm
          ref={formRef}
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={onClose}
          isSubmitting={isSubmitting}
          availableLocations={availableLocations}
          hideActions
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  headerButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    minWidth: 60,
  },
  title: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginBottom: theme.spacing.lg,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default StorageLocationSheet;
