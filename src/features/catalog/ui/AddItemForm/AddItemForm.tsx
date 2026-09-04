import React, { useEffect, useState } from 'react';
import { useTranslation } from '#/i18n';
import { errorService } from '#/services/errorService';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '#components/molecules/Button';
import { useForm, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  createItemSchema,
  suggestItemEditSchema,
  CreateItemFormData,
} from '#features/catalog/utils/itemValidation';
import {
  StorageState,
  ItemType,
  type BaseDimension,
  type ItemUnitInput,
} from '#/graphql/generated/schemaTypes';
import {
  MultiImagePicker,
  type SelectedImage,
} from '#features/catalog/components/MultiImagePicker';
import {
  UnitEntryList,
  type UnitEntry,
} from '#features/catalog/ui/UnitEntryList/UnitEntryList';
import { DropdownStack } from '#components/atoms/DropdownStack';
import {
  NetWeightEntryList,
  type NetWeightEntry,
} from '#features/catalog/ui/NetWeightEntryList/NetWeightEntryList';
import { DynamicFormFields } from '#components/molecules/DynamicFormFields';
import { type AddItemFormData } from '#/utils/items/createItemMapping';
import { PageIndicator } from '#components/molecules/PageIndicator/PageIndicator';
import { CollapsibleSection } from '#components/molecules/CollapsibleSection';
import { Text } from '#components/atoms/Text';
import { logValidationErrors } from '#utils/validation/common';
import { BarcodeInfo } from './BarcodeInfo';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import {
  type PageName,
  PAGES,
  PAGE_LABEL_KEYS,
  detectScanType,
  buildTabFieldGroups,
  isEditMode,
  requiresEditNote,
  MODE_CONFIG,
} from './fields';

/**
 * `edit` proposes changes for admin review (createItemSuggestion); `directEdit`
 * writes them straight through (updateItem). They render identically — the
 * caller picks by the item's viewer-scoped `canEdit`, and only the wording
 * differs.
 */
export type AddItemFormMode = 'create' | 'edit' | 'variant' | 'directEdit';

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
  baseDimension?: string;
  tags?: string[];
  categoryIds?: string[];
  netWeights?: Array<{ value: number; unitName: string; unitId?: string }>;
}

/**
 * The flat payload AddItemForm emits on submit; `mapFormToCreateItemInput`
 * turns it into the nested `CreateItemInput`. `AddItemFormData`'s index
 * signature is what lets extra fields (e.g. `editReason`) pass through.
 */
export type AddItemSubmitPayload = AddItemFormData & {
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
  const [seededBrandId, setSeededBrandId] = useState<string | undefined>(
    undefined,
  );
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

  const { t } = useTranslation();
  const modeConfig = MODE_CONFIG[mode];
  const editing = isEditMode(mode);

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
      if (initialData.baseDimension)
        values.baseDimension = initialData.baseDimension;
      if (initialData.tags) values.tags = initialData.tags;
      if (initialData.categoryIds) values.categoryIds = initialData.categoryIds;
    }

    return values;
  };

  // Seed the brand exactly once per incoming brandId. Re-seeding on every
  // render would undo the null that BrandAutocompleteField sets when the user
  // starts typing a different brand, silently pinning the original brand id to
  // the new name.
  if (initialData?.brandId && seededBrandId !== initialData.brandId) {
    setSeededBrandId(initialData.brandId);
    setSelectedBrandId(initialData.brandId);
  }

  const TAB_FIELDS = buildTabFieldGroups(
    t,
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
    // Only the review path mandates a note — see `requiresEditNote`.
    resolver: yupResolver(
      requiresEditNote(mode) ? suggestItemEditSchema : createItemSchema,
    ) as Resolver<CreateItemFormData>,
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
        value: parseDecimalInput(entry.value!),
        unitName: entry.unitName!,
        // Pass the resolved unit id when the user picked a known unit, so the
        // server links it directly instead of re-resolving by name.
        ...(entry.unitId ? { unitId: entry.unitId } : {}),
      }));

    const units: ItemUnitInput[] = unitEntries
      .filter(entry => entry.unitId || entry.unitName)
      .map((entry, index) => ({
        unitId: entry.unitId || undefined,
        unitName: entry.unitName || undefined,
        isDefault: index === 0,
        packageSize: entry.packageSize
          ? parseDecimalInput(entry.packageSize)
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
      shelfLifeDays: data.shelfLifeDays || undefined,
      shelfLifeOpenedDays: data.shelfLifeOpenedDays || undefined,
      imageUrl: data.imageUrl || undefined,
      netWeights: netWeights.length > 0 ? netWeights : undefined,
      units: units.length > 0 ? units : undefined,
      sku: data.sku || undefined,
      storeId: selectedStoreId || undefined,
      baseDimension: (data.baseDimension as BaseDimension) || undefined,
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
    label: t(PAGE_LABEL_KEYS[page]),
    hasError: tabHasError(page),
  }));
  const showAdvanced = advancedExpanded[activePage] || advancedHasError;

  return (
    <>
      <View style={styles.header}>
        <Text role="title" style={styles.title}>
          {title || t(modeConfig.title)}
        </Text>
        <Text role="caption" tone="secondary" testID="add-item-form-subtitle">
          {t(modeConfig.subtitle(!!barcode))}
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

      {/* Explicit zIndex + collapsable so inline dropdowns near the bottom of
          the form paint above the sibling submit-button container. */}
      <View style={styles.form} collapsable={false}>
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
              /* Every mode but `edit` writes through as the item's owner, so
                 the photos land APPROVED and `makePrimary` is honoured. On the
                 suggestion path they land PENDING and the server ignores it —
                 offering the star there would promise a hero that review may
                 never grant. */
              allowPrimarySelection={!requiresEditNote(mode)}
            />
            {!!editing && (
              <Text role="caption" tone="secondary" style={styles.notice}>
                {t('suggestItemEdit.photoNotice')}
              </Text>
            )}
          </View>
        )}

        {activePage === 'Inventory' && (
          <DropdownStack>
            <View style={styles.section}>
              <NetWeightEntryList
                entries={netWeightEntries}
                onEntriesChanged={setNetWeightEntries}
                disabled={loading}
                maxEntries={editing ? 1 : undefined}
              />
            </View>
            {/* Units are hidden while editing: Item.units can't be round-tripped
                into UnitEntry rows, so an empty list would read as "remove every
                unit" rather than "left untouched". */}
            {!editing && (
              <View style={styles.section}>
                <UnitEntryList
                  entries={unitEntries}
                  onEntriesChanged={setUnitEntries}
                  disabled={loading}
                />
              </View>
            )}
          </DropdownStack>
        )}

        {activeTab.advanced.length > 0 && (
          <CollapsibleSection
            title={t('labels.moreOptions')}
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
          {t(modeConfig.buttonLabel)}
        </Button>

        <Button
          variant="secondary"
          fullWidth
          disabled={loading}
          onPress={onClose}
        >
          {t('labels.cancel')}
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
    zIndex: theme.zIndex.raised,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  notice: {
    marginTop: theme.spacing.sm,
  },
  advancedContent: {
    paddingTop: theme.spacing.md,
  },
  buttonContainer: {
    gap: theme.spacing.base,
    paddingBottom: theme.spacing.lg,
  },
}));

export default AddItemForm;
