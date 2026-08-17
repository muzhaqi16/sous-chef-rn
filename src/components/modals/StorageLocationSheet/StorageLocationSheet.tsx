import React, { useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import {
  StorageLocationForm,
  type StorageLocationFormRef,
  type StorageLocationFormValues,
} from '#components/organisms/storageLocation/StorageLocationForm';
import { Text } from '#components/atoms/Text';

import { StorageLocation } from '#/graphql/generated/schemaTypes';

/**
 * The subset of {@link StorageLocation} fields the sheet actually reads to
 * populate the form. Narrower than the full schema type so callers (and
 * tests) don't have to build a full StorageLocation just to seed three
 * fields.
 */
export type StorageLocationInitialData = Partial<
  Pick<
    StorageLocation,
    | 'capacity'
    | 'capacityUnit'
    | 'color'
    | 'description'
    | 'isClimateControlled'
    | 'isDefault'
    | 'parentLocationId'
    | 'temperature'
  >
> & {
  id: string;
  name: string;
  type: StorageLocation['type'];
};

interface StorageLocationSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: StorageLocationFormValues) => Promise<boolean | void>;
  initialData?: StorageLocationInitialData | null;
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
  const { t } = useTranslation();
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['80%', '95%'],
  });
  const formRef = useRef<StorageLocationFormRef>(null);

  const handleSubmit = async (data: StorageLocationFormValues) => {
    const result = await onSubmit(data);
    if (result !== false) {
      onClose();
    }
  };

  const handleHeaderSave = () => {
    formRef.current?.submit();
  };

  const isEditing = !!initialData;
  const title = isEditing
    ? t('storageLocationSheet.editTitle')
    : t('storageLocationSheet.addTitle');
  const saveText = isEditing
    ? t('storageLocationSheet.update')
    : t('storageLocationSheet.create');

  return (
    <BottomSheetModal ref={ref} {...modalProps} index={0}>
      <BottomSheetScrollView
        style={styles.content}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <AppPressable
            onPress={onClose}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={t('storageLocationSheet.cancel')}
            disabled={isSubmitting}
          >
            <Text size="md" tone="secondary">
              {t('storageLocationSheet.cancel')}
            </Text>
          </AppPressable>

          <Text size="lg" weight="semibold" align="center" style={styles.title}>
            {title}
          </Text>

          <AppPressable
            onPress={handleHeaderSave}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={saveText}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ThemedActivityIndicator size="small" />
            ) : (
              <Text size="md" weight="semibold" align="right" tone="accent">
                {saveText}
              </Text>
            )}
          </AppPressable>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

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
    backgroundColor: theme.colors.border,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default StorageLocationSheet;
