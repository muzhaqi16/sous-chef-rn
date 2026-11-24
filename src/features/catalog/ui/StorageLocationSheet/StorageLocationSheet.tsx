import React, { useRef } from 'react';
import { useTranslation } from '#/i18n';
import {
  StorageLocationForm,
  type StorageLocationFormRef,
  type StorageLocationFormValues,
} from '#features/catalog/ui/StorageLocationForm';
import type { StorageLocation } from '#/graphql/generated/schemaTypes';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';

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
  availableLocations: Array<{
    id: string;
    name: string;
    type: StorageLocation['type'];
  }>;
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
      mode="form"
      gutter="page"
      visible={visible}
      onDismiss={onClose}
      snapPoints={['80%', '95%']}
      header={
        <SheetHeader
          title={title}
          onClose={onClose}
          confirm={{
            onPress: handleHeaderSave,
            accessibilityLabel: saveText,
            loading: isSubmitting,
          }}
        />
      }
    >
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
