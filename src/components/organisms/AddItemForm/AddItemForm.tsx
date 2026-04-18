import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '#/components/base/Button';
import { useForm, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { createItemSchema, CreateItemFormData } from '#utils/validation/item';
import {
  StorageState,
  ItemType,
  BaseDimension,
  type ItemUnitInput,
} from '#generated';
import { FormInput } from '#/components/molecules/FormInput';
import { Icon } from '#/utils/iconUtils';
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
import { PageIndicator } from '#/components/molecules/PageIndicator/PageIndicator';
import { CollapsibleSection } from '#/components/molecules/CollapsibleSection';
import { Text } from '#components/atoms/Text';

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
  netWeights?: Array<{ value: number; unitName: string; unitId?: string }>;
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
  /** Optional: when provided, UPC field renders a barcode icon that invokes this.
   *  The caller is responsible for navigating to a scanner and pushing the result
   *  back via `initialData.upc` — this component will `setValue('upc', ...)` in
   *  response to changes on that prop. */
  onScanUpc?: () => void;
}

const STORAGE_STATES = Object.values(StorageState);
const ITEM_TYPES = Object.values(ItemType);

type PageName = 'Basics' | 'Product' | 'Storage' | 'Inventory';
const PAGES: readonly PageName[] = [
  'Basics',
  'Product',
  'Storage',
  'Inventory',
];

// Helper function to detect if scanned value is barcode or SKU
const detectScanType = (value: string): 'barcode' | 'sku' => {
  // Common barcode formats (UPC, EAN, etc.) are typically 8, 12, 13, or 14 digits
  const isNumericBarcode = /^\d{8}(\d{4,6})?$/.test(value);

  if (isNumericBarcode) {
    return 'barcode';
  }

  return 'sku';
};

const ScanUpcButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const { theme } = useUnistyles();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Scan UPC with camera"
      style={({ pressed }) => [
        scanButtonStyles.button,
        pressed && scanButtonStyles.pressed,
      ]}
    >
      <Icon name="barcode-outline" size={22} color={theme.colors.primary} />
    </Pressable>
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

const buildTabFieldGroups = (
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
    name: 'storeName' as any,
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
    name: 'editReason' as any,
    label: 'Reason for Edit',
    placeholder:
      'What needs to be corrected? (e.g., wrong weight, missing image)',
    component: FormTextArea,
    props: { numberOfLines: 2 },
  };

  const inventoryAdvanced: FieldDef<CreateItemFormData>[] = [
    consumeIncrementField,
    consumeUnitField,
    tagsField,
    foodStampField,
    fsaField,
  ];
  if (mode === 'edit') {
    inventoryAdvanced.push(editReasonField);
  }

  return {
    Basics: {
      primary: [nameField, descriptionField, vendorField],
      advanced: [],
    },
    Product: {
      primary: [typeField, upcField],
      advanced: [skuField, storeField],
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
  onScanUpc,
}) => {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [unitEntries, setUnitEntries] = useState<UnitEntry[]>([]);
  const [netWeightEntries, setNetWeightEntries] = useState<NetWeightEntry[]>(
    () =>
      (initialData?.netWeights ?? []).map((nw, i) => ({
        id: `nw-initial-${i}`,
        value: String(nw.value),
        unitName: nw.unitName,
        unitId: nw.unitId,
      })),
  );

  const [currentPage, setCurrentPage] = useState(0);
  const [advancedExpanded, setAdvancedExpanded] = useState<
    Record<PageName, boolean>
  >({
    Basics: false,
    Product: false,
    Storage: false,
    Inventory: false,
  });

  const modeConfig = MODE_CONFIG[mode];

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

    if (scannedValue) {
      const scanType = detectScanType(scannedValue);
      if (scanType === 'barcode') {
        values.upc = scannedValue;
      } else {
        values.sku = scannedValue;
      }
    } else if (barcode) {
      values.upc = barcode;
    }

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

  if (initialData?.brandId && !selectedBrandId) {
    setSelectedBrandId(initialData.brandId);
  }

  const TAB_FIELDS = buildTabFieldGroups(
    setSelectedBrandId,
    setSelectedStoreId,
    mode,
    onScanUpc,
  );

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<CreateItemFormData>({
    resolver: yupResolver(createItemSchema) as Resolver<CreateItemFormData>,
    defaultValues: getInitialValues(),
    mode: 'onChange',
  });

  useEffect(() => {
    if (initialData?.upc) {
      setValue('upc', initialData.upc, { shouldValidate: true });
    }
  }, [initialData?.upc, setValue]);

  const handleFormSubmit = (data: CreateItemFormData) => {
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

    const systemTags: string[] = [];
    if (data.isFoodStampItem) {
      systemTags.push('food-stamp-eligible');
    }
    if (data.isFsaEligible) {
      systemTags.push('fsa-eligible');
    }

    let brandId: string | undefined;
    let brandName: string | undefined;
    if (selectedBrandId) {
      brandId = selectedBrandId;
      brandName = data.vendor;
    } else if (data.vendor) {
      brandName = data.vendor;
    }

    const netWeights = netWeightEntries
      .filter(entry => entry.value && entry.unitName)
      .map(entry => ({
        value: parseFloat(entry.value!),
        unitName: entry.unitName!,
      }));

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

  const activePage = PAGES[currentPage];
  const activeTab = TAB_FIELDS[activePage];
  const toggleAdvanced = (page: PageName) =>
    setAdvancedExpanded(prev => ({ ...prev, [page]: !prev[page] }));

  // Per-tab error detection — drives the red dot on PageIndicator and
  // auto-expansion of "More options" when an errored field lives inside it.
  const fieldHasError = (name: string) =>
    !!(errors as Record<string, unknown>)[name];
  const tabHasError = (page: PageName) => {
    const { primary, advanced } = TAB_FIELDS[page];
    return [...primary, ...advanced].some(f => fieldHasError(String(f.name)));
  };
  const advancedHasError = activeTab.advanced.some(f =>
    fieldHasError(String(f.name)),
  );
  const indicatorPages = PAGES.map(page => ({
    label: page,
    hasError: tabHasError(page),
  }));
  const showAdvanced = advancedExpanded[activePage] || advancedHasError;

  return (
    <>
      <View style={styles.header}>
        <Text size="2xl" weight="bold" style={styles.title}>
          {title || modeConfig.title}
        </Text>
        <Text size="sm" tone="secondary" lineHeight="tight">
          {modeConfig.subtitle(!!barcode)}
        </Text>
      </View>

      {!!(scannedValue || barcode) && (
        <View style={styles.barcodeInfo}>
          <Text
            size="xs"
            weight="semibold"
            tone="secondary"
            style={styles.barcodeLabel}
          >
            {scannedValue && detectScanType(scannedValue) === 'sku'
              ? 'SKU'
              : 'UPC/Barcode'}
          </Text>
          <Text size="md" weight="medium" style={styles.barcodeValue}>
            {scannedValue || barcode}
          </Text>
          {!!format && (
            <>
              <Text
                size="xs"
                weight="semibold"
                tone="secondary"
                style={styles.formatLabel}
              >
                Format
              </Text>
              <Text size="sm" weight="medium" tone="onSurfaceVariant">
                {format.toUpperCase()}
              </Text>
            </>
          )}
        </View>
      )}

      <PageIndicator
        pages={indicatorPages}
        currentPage={currentPage}
        onPagePress={setCurrentPage}
      />

      <View style={styles.form}>
        {activeTab.primary.length > 0 && (
          <DynamicFormFields
            fields={activeTab.primary}
            control={control}
            errors={errors}
          />
        )}

        {activePage === 'Basics' && (
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
        )}

        {activePage === 'Inventory' && (
          <>
            <View style={styles.section}>
              <NetWeightEntryList
                entries={netWeightEntries}
                onEntriesChanged={setNetWeightEntries}
                disabled={loading}
              />
            </View>
            <View style={styles.section}>
              <UnitEntryList
                entries={unitEntries}
                onEntriesChanged={setUnitEntries}
                disabled={loading}
              />
            </View>
          </>
        )}

        {activeTab.advanced.length > 0 && (
          <CollapsibleSection
            title="More options"
            expanded={showAdvanced}
            onToggle={() => toggleAdvanced(activePage)}
          >
            <View style={styles.advancedContent}>
              <DynamicFormFields
                fields={activeTab.advanced}
                control={control}
                errors={errors}
              />
            </View>
          </CollapsibleSection>
        )}
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
    marginBottom: theme.spacing.sm,
  },
  barcodeInfo: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.lg,
  },
  barcodeLabel: {
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  barcodeValue: {
    fontFamily: 'monospace',
    marginBottom: theme.spacing.sm,
  },
  formatLabel: {
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  form: {
    marginBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  advancedContent: {
    paddingTop: theme.spacing.md,
  },
  buttonContainer: {
    gap: theme.spacing['3'],
    paddingBottom: theme.spacing.lg,
  },
}));

export default AddItemForm;
