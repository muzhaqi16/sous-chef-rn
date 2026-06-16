import React, { useEffect, useState } from 'react';
import { errorService } from '#/services/errorService';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '#/components/base/Button';
import { useForm, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { createItemSchema, CreateItemFormData } from '#utils/validation/item';
import {
  StorageState,
  ItemType,
  type ItemUnitInput,
} from '#/graphql/generated/schemaTypes';
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
import { DynamicFormFields } from '#/components/molecules/DynamicFormFields';
import { PageIndicator } from '#/components/molecules/PageIndicator/PageIndicator';
import { CollapsibleSection } from '#/components/molecules/CollapsibleSection';
import { Text } from '#components/atoms/Text';
import { logValidationErrors } from '#utils/validation/common';
import { BarcodeInfo } from './BarcodeInfo';
import {
  type PageName,
  PAGES,
  detectScanType,
  buildTabFieldGroups,
  MODE_CONFIG,
} from './fields';

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

/**
 * The assembled item payload AddItemForm emits on submit: a loose record (the
 * consumer builds the CreateItem mutation input from it) plus the picked
 * images. Kept structurally loose intentionally — typing it to the exact
 * mutation input is a separate form-layer refactor.
 */
export type AddItemSubmitPayload = Record<string, unknown> & {
  selectedImages: SelectedImage[];
};

interface AddItemFormProps {
  barcode?: string;
  format?: string;
  scannedValue?: string; // The actual scanned value (could be barcode or SKU)
  onSubmit: (formData: AddItemSubmitPayload) => void;
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

  const getInitialValues = (): CreateItemFormData => {
    const values: CreateItemFormData = {
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

    const processedData: AddItemSubmitPayload = {
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

    onSubmit(processedData);
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

      <BarcodeInfo
        scannedValue={scannedValue}
        barcode={barcode}
        format={format}
      />

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
                errorService.reportError(error, { operation: 'selectImage' });
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
          onPress={handleSubmit(handleFormSubmit, logValidationErrors)}
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
