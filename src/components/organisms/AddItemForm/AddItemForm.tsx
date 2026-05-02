import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '#/components/base/Button';
import { useForm, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { createItemSchema, CreateItemFormData } from '#utils/validation/item';
import {
  StorageState,
  ItemType,
  BaseDimension,
  type ItemUnitInput,
} from '../../../graphql/generated/schemaTypes';
import { FormInput } from '#/components/molecules/FormInput';
import { FormTextArea } from '#/components/molecules/FormTextArea';
import { FormNumberInput } from '#/components/molecules/FormNumberInput';
import { FormSelect } from '#/components/molecules/FormSelect';
import { FormCheckbox } from '#/components/molecules/FormCheckbox';
import {
  MultiImagePicker,
  type SelectedImage,
} from '#/components/molecules/MultiImagePicker';
import {
  UnitEntryList,
  type UnitEntry,
} from '#/components/organisms/UnitEntryList/UnitEntryList';
import {
  NetWeightEntryList,
  type NetWeightEntry,
} from '#/components/organisms/NetWeightEntryList/NetWeightEntryList';
import {
  DynamicFormFields,
  type FieldDef,
} from '#/components/molecules/DynamicFormFields';

export type AddItemFormMode = 'create' | 'edit' | 'variant';

export interface AddItemFormInitialData {
  name?: string;
  description?: string;
  upc?: string;
  vendor?: string;
  brandId?: string;
  brandName?: string;
  imageUrl?: string;
  type?: string;
  storageState?: string;
  shelfLifeDays?: number;
  shelfLifeOpenedDays?: number;
  tags?: string[];
  categoryIds?: string[];
}

interface AddItemFormProps {
  barcode?: string;
  format?: string;
  scannedValue?: string; // The actual scanned value (could be barcode or SKU)
  onSubmit: (formData: CreateItemFormData) => void;
  onClose: () => void;
  loading?: boolean;
  title?: string;
  enableAutocomplete?: boolean;
  mode?: AddItemFormMode;
  initialData?: AddItemFormInitialData;
}

const STORAGE_STATES = Object.values(StorageState);
const ITEM_TYPES = Object.values(ItemType);

// Helper function to detect if scanned value is barcode or SKU
const detectScanType = (value: string): 'barcode' | 'sku' => {
  // Common barcode formats (UPC, EAN, etc.) are typically 8, 12, 13, or 14 digits
  const isNumericBarcode = /^\d{8}(\d{4,6})?$/.test(value);

  // If it's all digits and matches common barcode lengths, treat as barcode
  if (isNumericBarcode) {
    return 'barcode';
  }

  // Otherwise, treat as SKU (alphanumeric codes, shorter codes, etc.)
  return 'sku';
};

const getFormSections = (
  setSelectedBrandId: (id: string | null) => void,
  setSelectedStoreId: (id: string | null) => void,
  mode: AddItemFormMode = 'create',
): Array<{
  title: string;
  fields: FieldDef<CreateItemFormData>[];
}> => {
  const basicFields: FieldDef<CreateItemFormData>[] = [
    {
      name: 'name',
      label: 'Item Name',
      placeholder: 'Enter item name',
      component: FormInput,
      props: { autoCapitalize: 'words', required: true },
    },
    {
      name: 'description',
      label: 'Description',
      placeholder: 'Enter item description (optional)',
      component: FormTextArea,
      props: { numberOfLines: 3 },
    },
    {
      name: 'sku',
      label: 'SKU',
      placeholder: 'Enter SKU (optional)',
      component: FormInput,
    },
    {
      name: 'storeName' as any,
      label: 'Store (for SKU)',
      placeholder: 'Search for store',
      component: 'storeAutocomplete',
      props: {
        componentType: 'autocomplete',
        onStoreSelected: (storeId: string | null) =>
          setSelectedStoreId(storeId),
      },
    },
    {
      name: 'upc',
      label: 'UPC/Barcode',
      placeholder: 'Enter UPC/Barcode (optional)',
      component: FormInput,
      props: { keyboardType: 'numeric' },
    },
  ];

  // Add editReason field for edit mode
  if (mode === 'edit') {
    basicFields.push({
      name: 'editReason' as any,
      label: 'Reason for Edit',
      placeholder:
        'What needs to be corrected? (e.g., wrong weight, missing image)',
      component: FormTextArea,
      props: { numberOfLines: 2 },
    });
  }

  return [
    {
      title: 'Basic Information',
      fields: basicFields,
    },
    {
      title: 'Product Details',
      fields: [
        {
          name: 'type',
          label: 'Item Type',
          component: FormSelect,
          props: { componentType: 'select' },
          options: ITEM_TYPES.map(type => ({ label: type, value: type })),
        },
        {
          name: 'storageState',
          label: 'Storage State',
          component: FormSelect,
          props: { componentType: 'select' },
          options: STORAGE_STATES.map(state => ({
            label: state,
            value: state,
          })),
        },
        {
          name: 'shelfLifeDays',
          label: 'Shelf Life (Days)',
          placeholder: 'Enter shelf life in days',
          component: FormNumberInput,
          props: { componentType: 'number', keyboardType: 'numeric' },
        },
        {
          name: 'shelfLifeOpenedDays',
          label: 'Shelf Life Once Opened (Days)',
          placeholder: 'Enter shelf life once opened',
          component: FormNumberInput,
          props: { componentType: 'number', keyboardType: 'numeric' },
        },
        {
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
        },
        {
          name: 'defaultConsumeIncrement',
          label: 'Default Consume Increment',
          placeholder: 'e.g., 1',
          component: FormNumberInput,
          props: { componentType: 'number', keyboardType: 'decimal-pad' },
        },
        {
          name: 'defaultConsumeUnitId',
          label: 'Default Consume Unit',
          placeholder: 'tsp, cup, etc.',
          component: 'unitAutocomplete',
          props: {
            componentType: 'autocomplete',
            onUnitSelected: () => {},
          },
        },
      ],
    },
    {
      title: 'Brand & Vendor',
      fields: [
        {
          name: 'vendor',
          label: 'Brand/Vendor',
          placeholder: 'Enter brand or vendor name',
          component: 'brandAutocomplete',
          props: {
            componentType: 'autocomplete',
            onBrandSelected: (brandId: string | null) =>
              setSelectedBrandId(brandId),
          },
        },
      ],
    },
    {
      title: 'Tags & Metadata',
      fields: [
        {
          name: 'tags',
          label: 'Tags',
          placeholder: 'Comma-separated tags (e.g., organic, gluten-free)',
          component: FormTextArea,
          props: { numberOfLines: 2 },
          renderValue: (value: any) => {
            if (Array.isArray(value)) {
              return value.join(', ');
            }
            return value || '';
          },
          transformValue: (value: string) => {
            if (!value || typeof value !== 'string') return [];
            return value
              .split(',')
              .map(tag => tag.trim())
              .filter(tag => tag.length > 0);
          },
          transformOnBlur: true,
        },
      ],
    },
    {
      title: 'Item Flags',
      fields: [
        {
          name: 'isFoodStampItem',
          label: 'Food Stamp Eligible',
          component: FormCheckbox,
          props: { componentType: 'checkbox' },
        },
        {
          name: 'isFsaEligible',
          label: 'FSA Eligible',
          component: FormCheckbox,
          props: { componentType: 'checkbox' },
        },
      ],
    },
  ];
};

const MODE_CONFIG = {
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
      "Submit corrections \u2014 we'll review and update the catalog",
    buttonLabel: 'Submit Suggestion',
  },
  variant: {
    title: 'Create New Version',
    subtitle: () => 'Create a new version of this item for your region',
    buttonLabel: 'Create Version',
  },
};

const AddItemForm: React.FC<AddItemFormProps> = ({
  barcode,
  format,
  scannedValue,
  onSubmit,
  onClose,
  loading = false,
  title,
  mode = 'create',
  initialData,
}) => {
  // Track selected brand/store IDs separately from the display names
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  // Multi-image, unit entry, and net weight entry state (managed outside react-hook-form)
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [unitEntries, setUnitEntries] = useState<UnitEntry[]>([]);
  const [netWeightEntries, setNetWeightEntries] = useState<NetWeightEntry[]>(
    [],
  );

  const modeConfig = MODE_CONFIG[mode];

  // Determine what to populate based on scanned value and initialData
  const getInitialValues = () => {
    const values: any = {
      name: '',
      description: '',
      sku: '',
      upc: '',
      categoryIds: [],
      units: [],
      imageUrl: '',
      tags: [],
      storageState: StorageState.Ambient,
      type: ItemType.Foundation,
      shelfLifeDays: undefined,
      shelfLifeOpenedDays: undefined,
      baseDimension: '',
      defaultConsumeIncrement: undefined,
      defaultConsumeUnitId: '',
      vendor: '',
      storeName: '',
      isFoodStampItem: false,
      isFsaEligible: false,
      editReason: '',
    };

    // If we have a scanned value, detect and populate the appropriate field
    if (scannedValue) {
      const scanType = detectScanType(scannedValue);
      if (scanType === 'barcode') {
        values.upc = scannedValue;
      } else {
        values.sku = scannedValue;
      }
    } else if (barcode) {
      // Fallback to legacy barcode prop
      values.upc = barcode;
    }

    // Merge initialData for edit/variant modes
    if (initialData) {
      if (initialData.name) values.name = initialData.name;
      if (initialData.description) values.description = initialData.description;
      if (initialData.upc) values.upc = initialData.upc;
      if (initialData.vendor) values.vendor = initialData.vendor;
      if (initialData.imageUrl) values.imageUrl = initialData.imageUrl;
      if (initialData.type) values.type = initialData.type;
      if (initialData.storageState)
        values.storageState = initialData.storageState;
      if (initialData.shelfLifeDays != null)
        values.shelfLifeDays = initialData.shelfLifeDays;
      if (initialData.shelfLifeOpenedDays != null)
        values.shelfLifeOpenedDays = initialData.shelfLifeOpenedDays;
      if (initialData.tags) values.tags = initialData.tags;
      if (initialData.categoryIds) values.categoryIds = initialData.categoryIds;
    }

    return values;
  };

  // Initialize brand ID from initialData if available
  if (initialData?.brandId && !selectedBrandId) {
    setSelectedBrandId(initialData.brandId);
  }

  // Get form sections with access to setSelectedBrandId
  const FORM_SECTIONS = getFormSections(
    setSelectedBrandId,
    setSelectedStoreId,
    mode,
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<CreateItemFormData>({
    resolver: yupResolver(createItemSchema) as Resolver<CreateItemFormData>,
    defaultValues: getInitialValues(),
    mode: 'onChange',
  });

  const handleFormSubmit = (data: CreateItemFormData) => {
    // Process existing tags
    let tags: string[] = [];
    if (data.tags) {
      if (Array.isArray(data.tags)) {
        tags = data.tags.filter((tag): tag is string => Boolean(tag));
      } else if (typeof data.tags === 'string') {
        tags = (data.tags as string)
          .split(',')
          .map((tag: string) => tag.trim())
          .filter(Boolean);
      }
    }

    // Add system tags based on boolean flags
    const systemTags: string[] = [];
    if (data.isFoodStampItem) {
      systemTags.push('food-stamp-eligible');
    }
    if (data.isFsaEligible) {
      systemTags.push('fsa-eligible');
    }

    // Process brand field - send both ID and name when available
    let brandId: string | undefined;
    let brandName: string | undefined;
    if (selectedBrandId) {
      brandId = selectedBrandId;
      brandName = data.vendor;
    } else if (data.vendor) {
      brandName = data.vendor;
    }

    // Map net weight entries
    const netWeights = netWeightEntries
      .filter(entry => entry.value && entry.unitName)
      .map(entry => ({
        value: parseFloat(entry.value!),
        unitName: entry.unitName!,
      }));

    // Map unit entries to ItemUnitInput[]
    const units: ItemUnitInput[] = unitEntries
      .filter(entry => entry.unitId || entry.unitName)
      .map((entry, index) => ({
        unitId: entry.unitId || undefined,
        unitName: entry.unitName || undefined,
        isDefault: index === 0,
        packageSize: entry.packageSize
          ? parseFloat(entry.packageSize)
          : undefined,
        contentUnitId: entry.contentUnitId || undefined,
        contentUnitName: entry.contentUnitName || undefined,
      }));

    const allTags =
      tags.length > 0 || systemTags.length > 0
        ? [...tags, ...systemTags]
        : undefined;

    // Fields are mapped to the form schema, not directly to CreateItemInput
    // (the API input type uses nested objects like brand, productDetails, etc.)
    const processedData: Record<string, unknown> & {
      selectedImages: SelectedImage[];
    } = {
      name: data.name,
      description: data.description || undefined,
      type: (data.type as ItemType) || undefined,
      brandId: brandId || undefined,
      brandName: brandName || undefined,
      storageState: (data.storageState as StorageState) || undefined,
      categoryIds:
        data.categoryIds && data.categoryIds.length > 0
          ? data.categoryIds
          : undefined,
      tags: allTags,
      primaryUpc: data.upc || undefined,
      vendor: brandName || undefined,
      shelfLifeDays: data.shelfLifeDays || undefined,
      shelfLifeOpenedDays: data.shelfLifeOpenedDays || undefined,
      imageUrl: data.imageUrl || undefined,
      netWeights: netWeights.length > 0 ? netWeights : undefined,
      units: units.length > 0 ? units : undefined,
      // Pass through for form-level processing
      sku: data.sku || undefined,
      storeId: selectedStoreId || undefined,
      baseDimension: data.baseDimension || undefined,
      defaultConsumeIncrement: data.defaultConsumeIncrement || undefined,
      defaultConsumeUnitId: data.defaultConsumeUnitId || undefined,
      editReason: data.editReason || undefined,
      selectedImages,
    };

    onSubmit(processedData as any);
  };

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{title || modeConfig.title}</Text>
        <Text style={styles.subtitle}>{modeConfig.subtitle(!!barcode)}</Text>
      </View>

      {!!(scannedValue || barcode) && (
        <View style={styles.barcodeInfo}>
          <Text style={styles.barcodeLabel}>
            {scannedValue && detectScanType(scannedValue) === 'sku'
              ? 'SKU'
              : 'UPC/Barcode'}
          </Text>
          <Text style={styles.barcodeValue}>{scannedValue || barcode}</Text>
          {!!format && (
            <>
              <Text style={styles.formatLabel}>Format</Text>
              <Text style={styles.formatValue}>{format.toUpperCase()}</Text>
            </>
          )}
        </View>
      )}

      <View style={styles.form}>
        {FORM_SECTIONS.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <DynamicFormFields
              fields={section.fields}
              control={control}
              errors={errors}
            />
          </View>
        ))}

        {/* Dynamic Net Weight Entries */}
        <View style={styles.section}>
          <NetWeightEntryList
            entries={netWeightEntries}
            onEntriesChanged={setNetWeightEntries}
            disabled={loading}
          />
        </View>

        {/* Dynamic Unit Entries */}
        <View style={styles.section}>
          <UnitEntryList
            entries={unitEntries}
            onEntriesChanged={setUnitEntries}
            disabled={loading}
          />
        </View>

        {/* Multi-Image Picker Section */}
        <View style={styles.section}>
          <MultiImagePicker
            images={selectedImages}
            onImagesChanged={setSelectedImages}
            onError={error => {
              console.error('Image selection error:', error);
            }}
            disabled={loading}
          />
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          variant="primary"
          fullWidth
          loading={loading}
          disabled={!isValid}
          onPress={handleSubmit(handleFormSubmit)}
        >
          {modeConfig.buttonLabel}
        </Button>

        <Button
          variant="secondary"
          fullWidth
          disabled={loading}
          onPress={onClose}
        >
          Cancel
        </Button>
      </View>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fonts.size['2xl'],
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  barcodeInfo: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.lg,
  },
  barcodeLabel: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  barcodeValue: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    fontFamily: 'monospace',
    marginBottom: theme.spacing.sm,
  },
  formatLabel: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  formatValue: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textOnSurfaceVariant,
  },
  form: {
    marginBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  buttonContainer: {
    gap: 12,
    paddingBottom: theme.spacing.lg,
  },
}));

export default AddItemForm;
