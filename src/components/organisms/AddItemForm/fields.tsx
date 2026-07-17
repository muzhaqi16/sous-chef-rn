import React from 'react';
import { useTranslation } from 'react-i18next';
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

// Minimal structural type for the translation function so this module doesn't
// depend on i18next's generic `TFunction` namespace typing. `useTranslation().t`
// is assignable to it.
type Translate = (key: string, options?: Record<string, unknown>) => string;

/** `edit` proposes changes for review; `directEdit` writes them through. Both
 *  render the same form, so most field logic branches on this rather than mode. */
export const isEditMode = (mode: AddItemFormMode): boolean =>
  mode === 'edit' || mode === 'directEdit';

/**
 * Only the review path needs — or can send — a note. `CreateItemSuggestionInput.note`
 * is `String!` and the admin has nothing else to judge the diff against. A direct
 * edit has no reviewer and `UpdateItemInput` no longer accepts a note, so its form
 * omits the field entirely.
 */
export const requiresEditNote = (mode: AddItemFormMode): boolean =>
  mode === 'edit';

const STORAGE_STATES = Object.values(StorageState);
const ITEM_TYPES = Object.values(ItemType);

export type PageName = 'Basics' | 'Product' | 'Storage' | 'Inventory';
export const PAGES: readonly PageName[] = [
  'Basics',
  'Product',
  'Storage',
  'Inventory',
];

/** Page names double as record keys, so the display label is looked up here. */
export const PAGE_LABEL_KEYS: Record<PageName, string> = {
  Basics: 'addItemForm.tabs.basics',
  Product: 'addItemForm.tabs.product',
  Storage: 'addItemForm.tabs.storage',
  Inventory: 'addItemForm.tabs.inventory',
};

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
  const { t } = useTranslation();

  return (
    <AppPressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('addItemForm.scanUpcA11y')}
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
  t: Translate,
  setSelectedBrandId: (id: string | null) => void,
  setSelectedStoreId: (id: string | null) => void,
  mode: AddItemFormMode,
  onScanUpc: (() => void) | undefined,
): Record<PageName, TabFieldGroups> => {
  const nameField: FieldDef<CreateItemFormData> = {
    name: 'name',
    label: t('addItemForm.fields.name.label'),
    placeholder: t('addItemForm.fields.name.placeholder'),
    component: FormInput,
    props: { autoCapitalize: 'words', required: true },
  };
  const descriptionField: FieldDef<CreateItemFormData> = {
    name: 'description',
    label: t('addItemForm.fields.description.label'),
    placeholder: t('addItemForm.fields.description.placeholder'),
    component: FormTextArea,
    props: { numberOfLines: 3 },
  };
  const vendorField: FieldDef<CreateItemFormData> = {
    name: 'vendor',
    label: t('addItemForm.fields.vendor.label'),
    placeholder: t('addItemForm.fields.vendor.placeholder'),
    component: 'brandAutocomplete',
    props: {
      componentType: 'autocomplete',
      onBrandSelected: setSelectedBrandId,
    },
  };

  const typeField: FieldDef<CreateItemFormData> = {
    name: 'type',
    label: t('addItemForm.fields.type.label'),
    component: FormSelect,
    props: { componentType: 'select' },
    options: ITEM_TYPES.map(type => ({
      label: t(`itemType.${type}`),
      value: type,
    })),
  };
  const upcField: FieldDef<CreateItemFormData> = {
    name: 'upc',
    label: t('addItemForm.fields.upc.label'),
    placeholder: t('addItemForm.fields.upc.placeholder'),
    component: FormInput,
    props: {
      keyboardType: 'numeric',
      trailing: onScanUpc ? <ScanUpcButton onPress={onScanUpc} /> : undefined,
    },
  };
  const skuField: FieldDef<CreateItemFormData> = {
    name: 'sku',
    label: t('addItemForm.fields.sku.label'),
    placeholder: t('addItemForm.fields.sku.placeholder'),
    component: FormInput,
  };
  const storeField: FieldDef<CreateItemFormData> = {
    name: 'storeName',
    label: t('addItemForm.fields.store.label'),
    placeholder: t('addItemForm.fields.store.placeholder'),
    component: 'storeAutocomplete',
    props: {
      componentType: 'autocomplete',
      onStoreSelected: setSelectedStoreId,
    },
  };

  const storageStateField: FieldDef<CreateItemFormData> = {
    name: 'storageState',
    label: t('addItemForm.fields.storageState.label'),
    component: FormSelect,
    props: { componentType: 'select' },
    options: STORAGE_STATES.map(state => ({
      label: t(`storageState.${state}`),
      value: state,
    })),
  };
  const shelfLifeField: FieldDef<CreateItemFormData> = {
    name: 'shelfLifeDays',
    label: t('addItemForm.fields.shelfLife.label'),
    placeholder: t('addItemForm.fields.shelfLife.placeholder'),
    component: FormNumberInput,
    props: { componentType: 'number', keyboardType: 'numeric' },
  };
  const shelfLifeOpenedField: FieldDef<CreateItemFormData> = {
    name: 'shelfLifeOpenedDays',
    label: t('addItemForm.fields.shelfLifeOpened.label'),
    placeholder: t('addItemForm.fields.shelfLifeOpened.placeholder'),
    component: FormNumberInput,
    props: { componentType: 'number', keyboardType: 'numeric' },
  };
  const baseDimensionField: FieldDef<CreateItemFormData> = {
    name: 'baseDimension',
    label: t('addItemForm.fields.baseDimension.label'),
    component: FormSelect,
    props: { componentType: 'select' },
    options: [
      { label: t('baseDimension.none'), value: '' },
      {
        label: t(`baseDimension.${BaseDimension.Volume}`),
        value: BaseDimension.Volume,
      },
      {
        label: t(`baseDimension.${BaseDimension.Mass}`),
        value: BaseDimension.Mass,
      },
      {
        label: t(`baseDimension.${BaseDimension.Count}`),
        value: BaseDimension.Count,
      },
    ],
  };

  const consumeIncrementField: FieldDef<CreateItemFormData> = {
    name: 'defaultConsumeIncrement',
    label: t('addItemForm.fields.consumeIncrement.label'),
    placeholder: t('addItemForm.fields.consumeIncrement.placeholder'),
    component: FormNumberInput,
    props: { componentType: 'number', keyboardType: 'decimal-pad' },
  };
  const consumeUnitField: FieldDef<CreateItemFormData> = {
    name: 'defaultConsumeUnitId',
    label: t('addItemForm.fields.consumeUnit.label'),
    placeholder: t('addItemForm.fields.consumeUnit.placeholder'),
    component: 'unitAutocomplete',
    props: {
      componentType: 'autocomplete',
      onUnitSelected: () => {},
    },
  };
  const tagsField: FieldDef<CreateItemFormData> = {
    name: 'tags',
    label: t('addItemForm.fields.tags.label'),
    placeholder: t('addItemForm.fields.tags.placeholder'),
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
    label: t('addItemForm.fields.foodStamp.label'),
    component: FormCheckbox,
    props: { componentType: 'checkbox' },
  };
  const fsaField: FieldDef<CreateItemFormData> = {
    name: 'isFsaEligible',
    label: t('addItemForm.fields.fsa.label'),
    component: FormCheckbox,
    props: { componentType: 'checkbox' },
  };
  // Shown only on the review path, where the note is the admin's sole context
  // for the diff (required). The direct-edit path writes straight through and
  // the server no longer accepts a note there, so the field is omitted below.
  const noteRequired = requiresEditNote(mode);
  const editReasonField: FieldDef<CreateItemFormData> = {
    name: 'editReason',
    label: t('addItemForm.fields.editNote.label'),
    placeholder: t('addItemForm.fields.editNote.placeholder'),
    component: FormTextArea,
    props: { numberOfLines: 3, required: true },
  };

  const editing = isEditMode(mode);

  const inventoryAdvanced: FieldDef<CreateItemFormData>[] = [
    tagsField,
    foodStampField,
    fsaField,
  ];
  // Consume increment/unit are hidden while editing: the unit field's form
  // value is the text the user typed, not the id `packageInfo.defaultConsumeUnitId`
  // expects, so there is nothing to diff a saved item against.
  if (!editing) {
    inventoryAdvanced.unshift(consumeIncrementField, consumeUnitField);
  }

  return {
    Basics: {
      // The note leads on the review path — burying a required field on the last
      // tab inside "More options" would block submit with no visible cause.
      primary: noteRequired
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

/**
 * Per-mode copy, held as i18n keys rather than text so this stays a static
 * literal the form can index by mode. The caller resolves them with `t`.
 */
export const MODE_CONFIG = {
  create: {
    title: 'addItemForm.modes.create.title',
    subtitle: (hasBarcode: boolean) =>
      hasBarcode
        ? 'addItemForm.modes.create.subtitleScanned'
        : 'addItemForm.modes.create.subtitle',
    buttonLabel: 'addItemForm.modes.create.button',
  },
  edit: {
    title: 'addItemForm.modes.edit.title',
    subtitle: () => 'addItemForm.modes.edit.subtitle',
    buttonLabel: 'addItemForm.modes.edit.button',
  },
  // Same form as `edit`, but the caller resolved that this user may write
  // straight through, so the wording promises an immediate change.
  directEdit: {
    title: 'addItemForm.modes.directEdit.title',
    subtitle: () => 'addItemForm.modes.directEdit.subtitle',
    buttonLabel: 'addItemForm.modes.directEdit.button',
  },
  variant: {
    title: 'addItemForm.modes.variant.title',
    subtitle: () => 'addItemForm.modes.variant.subtitle',
    buttonLabel: 'addItemForm.modes.variant.button',
  },
};
