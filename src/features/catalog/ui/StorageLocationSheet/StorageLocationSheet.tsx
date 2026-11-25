import React from 'react';
import {
  StorageLocationForm,
  type StorageLocationFormValues,
} from '#features/catalog/ui/StorageLocationForm';
import type { StorageLocation } from '#graphql/generated/schemaTypes';
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
}) => (
  // The form owns the bar: its confirm submits the form's own state.
  <Sheet
    mode="form"
    visible={visible}
    onDismiss={onClose}
    snapPoints={['80%', '95%']}
    headerFromContent
  >
    <StorageLocationForm
      initialData={initialData}
      onSubmit={onSubmit}
      onClose={onClose}
      isSubmitting={isSubmitting}
      availableLocations={availableLocations}
    />
  </Sheet>
);
