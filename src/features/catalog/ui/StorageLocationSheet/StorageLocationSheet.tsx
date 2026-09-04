import React, { useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import {
  StorageLocationForm,
  type StorageLocationFormRef,
  type StorageLocationFormValues,
} from '#features/catalog/ui/StorageLocationForm';
import { Text } from '#components/atoms/Text';

import { StorageLocation } from '#/graphql/generated/schemaTypes';
import { Divider } from '#components/atoms/Divider';
import { Sheet } from '#components/templates/Sheet';

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
  const saveText = isEditing ? t('labels.update') : t('labels.create');

  return (
    <Sheet
      mode="action"
      visible={visible}
      onDismiss={onClose}
      snapPoints={['80%', '95%']}
      style={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <AppPressable
          onPress={onClose}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel={t('labels.cancel')}
          disabled={isSubmitting}
        >
          <Text tone="secondary">{t('labels.cancel')}</Text>
        </AppPressable>

        <Text role="heading" align="center" style={styles.title}>
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
            <Text role="bodyStrong" align="right" tone="accent">
              {saveText}
            </Text>
          )}
        </AppPressable>
      </View>

      {/* Divider */}
      <Divider style={styles.dividerGap} />

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
    </Sheet>
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
  dividerGap: {
    marginBottom: theme.spacing.lg,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default StorageLocationSheet;
