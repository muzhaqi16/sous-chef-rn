import React from 'react';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import type { CreateItemFormData } from '#utils/validation/item';
import {
  StorageState,
  ItemType,
  BaseDimension,
} from '#/graphql/generated/schemaTypes';
import { FormInput } from '#/components/molecules/FormInput';
import { Icon } from '#/utils/iconUtils';
import { FormTextArea } from '#/components/molecules/FormTextArea';
import { FormNumberInput } from '#/components/molecules/FormNumberInput';
import { FormSelect } from '#/components/molecules/FormSelect';
import { FormCheckbox } from '#/components/molecules/FormCheckbox';
import { type FieldDef } from '#/components/molecules/DynamicFormFields';
// Type-only, so this does not create a runtime cycle with AddItemForm (which
// imports the field builders below).
import type { AddItemFormMode } from './AddItemForm';

/** `edit` proposes changes for review; `directEdit` writes them through. Both
 *  render the same form, so most field logic branches on this rather than mode. */
export const isEditMode = (mode: AddItemFormMode): boolean =>
  mode === 'edit' || mode === 'directEdit';

const STORAGE_STATES = Object.values(StorageState);
const ITEM_TYPES = Object.values(ItemType);

export type PageName = 'Basics' | 'Product' | 'Storage' | 'Inventory';
export const PAGES: readonly PageName[] = [
  'Basics',
  'Product',
  'Storage',
  'Inventory',
];

// Helper function to detect if scanned value is barcode or SKU
export const detectScanType = (value: string): 'barcode' | 'sku' => {
  // Common barcode formats (UPC, EAN, etc.) are typically 8, 12, 13, or 14 digits
  const isNumericBarcode = /^\d{8}(\d{4,6})?$/.test(value);

  if (isNumericBarcode) {
    return 'barcode';
  }

  return 'sku';
};

export const ScanUpcButton: React.FC<{ onPress: () => void }> = ({
  onPress,
}) => {
  return (
    <AppPressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Scan UPC with camera"
      style={scanButtonStyles.button}
    >
      <Icon name="barcode-outline" size={22} tone="primary" />
    </AppPressable>
  );
};

const scanButtonStyles = StyleSheet.create(theme => ({
  button: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

type TabFieldGroups = {
  primary: FieldDef<CreateItemFormData>[];
  advanced: FieldDef<CreateItemFormData>[];
};

export const buildTabFieldGroups = (
  setSelectedBrandId: (id: string | null) => void,
  setSelectedStoreId: (id: string | null) => void,
  mode: AddItemFormMode,
  onScanUpc: (() => void) | undefined,
): Record<PageName, TabFieldGroups> => {
  const nameField: FieldDef<CreateItemFormData> = {
    name: 'name',
    label: 'Item Name',
    placeholder: 'Enter item name',
    component: FormInput,
    props: { autoCapitalize: 'words', required: true },
  };
  const descriptionField: FieldDef<CreateItemFormData> = {
    name: 'description',
    label: 'Description',
    placeholder: 'Enter item description (optional)',
    component: FormTextArea,
    props: { numberOfLines: 3 },
  };
  const vendorField: FieldDef<CreateItemFormData> = {
    name: 'vendor',
    label: 'Brand/Vendor',
    placeholder: 'Enter brand or vendor name',
    component: 'brandAutocomplete',
    props: {
      componentType: 'autocomplete',
      onBrandSelected: setSelectedBrandId,
    },
  };

  const typeField: FieldDef<CreateItemFormData> = {
    name: 'type',
    label: 'Item Type',
    component: FormSelect,
    props: { componentType: 'select' },
    options: ITEM_TYPES.map(type => ({ label: type, value: type })),
  };
  const upcField: FieldDef<CreateItemFormData> = {
    name: 'upc',
    label: 'UPC/Barcode',
    placeholder: 'Enter UPC/Barcode (optional)',
    component: FormInput,
    props: {
      keyboardType: 'numeric',
      trailing: onScanUpc ? <ScanUpcButton onPress={onScanUpc} /> : undefined,
    },
  };
  const skuField: FieldDef<CreateItemFormData> = {
    name: 'sku',
    label: 'SKU',
    placeholder: 'Enter SKU (optional)',
    component: FormInput,
  };
  const storeField: FieldDef<CreateItemFormData> = {
    name: 'storeName',
    label: 'Store (for SKU)',
    placeholder: 'Search for store',
    component: 'storeAutocomplete',
    props: {
      componentType: 'autocomplete',
      onStoreSelected: setSelectedStoreId,
    },
  };

  const storageStateField: FieldDef<CreateItemFormData> = {
    name: 'storageState',
    label: 'Storage State',
    component: FormSelect,
    props: { componentType: 'select' },
    options: STORAGE_STATES.map(state => ({ label: state, value: state })),
  };
  const shelfLifeField: FieldDef<CreateItemFormData> = {
    name: 'shelfLifeDays',
    label: 'Shelf Life (Days)',
    placeholder: 'Enter shelf life in days',
    component: FormNumberInput,
    props: { componentType: 'number', keyboardType: 'numeric' },
  };
  const shelfLifeOpenedField: FieldDef<CreateItemFormData> = {
    name: 'shelfLifeOpenedDays',
    label: 'Shelf Life Once Opened (Days)',
    placeholder: 'Enter shelf life once opened',
    component: FormNumberInput,
    props: { componentType: 'number', keyboardType: 'numeric' },
  };
  const baseDimensionField: FieldDef<CreateItemFormData> = {
    name: 'baseDimension',
    label: 'Base Dimension',
    component: FormSelect,
    props: { componentType: 'select' },
    options: [
      { label: 'None', value: '' },
      { label: 'Volume', value: BaseDimension.Volume },
      { label: 'Mass', value: BaseDimension.Mass },
      { label: 'Count', value: BaseDimension.Count },
    ],
  };

  const consumeIncrementField: FieldDef<CreateItemFormData> = {
    name: 'defaultConsumeIncrement',
    label: 'Default Consume Increment',
    placeholder: 'e.g., 1',
    component: FormNumberInput,
    props: { componentType: 'number', keyboardType: 'decimal-pad' },
  };
  const consumeUnitField: FieldDef<CreateItemFormData> = {
    name: 'defaultConsumeUnitId',
    label: 'Default Consume Unit',
    placeholder: 'tsp, cup, etc.',
    component: 'unitAutocomplete',
    props: {
      componentType: 'autocomplete',
      onUnitSelected: () => {},
    },
  };
  const tagsField: FieldDef<CreateItemFormData> = {
    name: 'tags',
    label: 'Tags',
    placeholder: 'Comma-separated tags (e.g., organic, gluten-free)',
    component: FormTextArea,
    props: { numberOfLines: 2 },
    renderValue: (value: unknown) => {
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return typeof value === 'string' ? value : '';
    },
    transformValue: (value: unknown) => {
      if (!value || typeof value !== 'string') return [];
      return value
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    },
    transformOnBlur: true,
  };
  const foodStampField: FieldDef<CreateItemFormData> = {
    name: 'isFoodStampItem',
    label: 'Food Stamp Eligible',
    component: FormCheckbox,
    props: { componentType: 'checkbox' },
  };
  const fsaField: FieldDef<CreateItemFormData> = {
    name: 'isFsaEligible',
    label: 'FSA Eligible',
    component: FormCheckbox,
    props: { componentType: 'checkbox' },
  };
  const editReasonField: FieldDef<CreateItemFormData> = {
    name: 'editReason',
    label: 'What needs fixing?',
    placeholder:
      'Tell the reviewer what is wrong (e.g., wrong net weight on the label)',
    component: FormTextArea,
    props: { numberOfLines: 3, required: true },
  };

  const editing = isEditMode(mode);

  const inventoryAdvanced: FieldDef<CreateItemFormData>[] = [
    tagsField,
    foodStampField,
    fsaField,
  ];
  // Consume increment/unit are create-only: updateItem never reads either from
  // packageInfo, so editing them would report success and change nothing.
  if (!editing) {
    inventoryAdvanced.unshift(consumeIncrementField, consumeUnitField);
  }

  return {
    Basics: {
      // The note is required in edit modes, so it leads. Buried on the last tab
      // inside "More options" it would block submit with no visible cause.
      primary: editing
        ? [editReasonField, nameField, descriptionField, vendorField]
        : [nameField, descriptionField, vendorField],
      advanced: [],
    },
    Product: {
      primary: [typeField, upcField],
      // SKU/store are create-only: Item.storeSkus is a connection the form
      // never loads, so an edit can't tell an addition from a duplicate.
      advanced: editing ? [] : [skuField, storeField],
    },
    Storage: {
      primary: [storageStateField, shelfLifeField],
      advanced: [shelfLifeOpenedField, baseDimensionField],
    },
    Inventory: {
      primary: [],
      advanced: inventoryAdvanced,
    },
  };
};

export const MODE_CONFIG = {
  create: {
    title: 'Add New Item',
    subtitle: (hasBarcode: boolean) =>
      hasBarcode
        ? 'Add this item to the database for future scans'
        : 'Create a new item with basic information',
    buttonLabel: 'Add Item',
  },
  edit: {
    title: 'Suggest Edit',
    subtitle: () =>
      'An admin reviews your changes — the listing stays as it is until then',
    buttonLabel: 'Submit Suggestion',
  },
  // Same form as `edit`, but the caller resolved that this user may write
  // straight through, so the wording promises an immediate change.
  directEdit: {
    title: 'Edit Item',
    subtitle: () => 'Your changes go live right away',
    buttonLabel: 'Save Changes',
  },
  variant: {
    title: 'Create New Version',
    subtitle: () => 'Create a new version of this item for your region',
    buttonLabel: 'Create Version',
  },
};
