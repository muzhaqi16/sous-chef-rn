import { pantryTestIDs } from '#features/pantry/testIDs';
import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { Text } from '#components/atoms/Text';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';

import { useSelectedPantryId, useSelectedHomeId } from '#store/useAppStore';
import { usePantryItemFormData } from '#features/pantry/hooks/usePantryItemFormData';
import {
  StorageState,
  ItemCondition,
  type StorageType,
  type UnitType,
} from '#/graphql/generated/schemaTypes';
import { useUpdatePantryItem } from '#features/pantry/hooks/mutations/useUpdatePantryItem';
import { useUpdatePantryItemQuantity } from '#features/pantry/hooks/mutations/useUpdatePantryItemQuantity';
import { useResolveUnit } from '#features/pantry/hooks/mutations/useResolveUnit';
import {
  emptyUnitSelection,
  type UnitSelection,
} from '#features/pantry/hooks/mutations/types';
import type { FieldDef } from '#components/molecules/DynamicFormFields';
import { DynamicFormFields } from '#components/molecules/DynamicFormFields';
import { FormInput } from '#components/atoms/FormInput';
import { FormScreen } from '#components/templates/FormScreen';
import { PageIndicator } from '#components/molecules/PageIndicator/PageIndicator';
import { CollapsibleSection } from '#components/molecules/CollapsibleSection';
import { ItemInformationSection } from './ItemInformationSection';
import { QuantitySection } from './QuantitySection';
import { StorageDetailsSection } from './StorageDetailsSection';
import { NetWeightSection } from './NetWeightSection';
import { usePantryItemFormSubmit } from './usePantryItemFormSubmit';
import { editedAmount } from './editedAmount';
import { usePantryUnitChange } from '#features/pantry/hooks/usePantryUnitChange';
import { logValidationErrors } from '#utils/validation/common';
import {
  TAB_FIELDS,
  INVENTORY_ADVANCED_FIELDS,
  editItemSchema,
} from './pantryItemFormConfig';
import {
  PAGES,
  PAGE_LABEL_KEYS,
  type PageName,
} from '#features/catalog/ui/AddItemForm/fields';
import { formatNumberForInput } from '#/utils/formatters/number';
import {
  formatQuantityForInput,
  getUnitDisplayText,
} from '#/utils/formatQuantity';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { firstNonBlank } from '#/utils/firstNonBlank';
import type { PantryItemForm_PantryItemFragment } from './PantryItemForm.generated';
import type { StorageLocationOption } from '#features/catalog/hooks/useStorageLocationAutocomplete';
import { fromDateKey } from '#/utils/dateUtils';

export interface PantryItemFormData {
  itemName?: string;
  selectedItemId?: string;
  brand?: string;

  quantityInput?: string;
  unit: string; // Tracking unit (for counting items)

  tags?: string[];

  minQuantity?: string;
  restockQuantity?: string;

  netWeight?: string;
  netWeightUnit?: string;
  netWeightUnitId?: string;

  storageState: StorageState;
  condition: ItemCondition;
  location: string;
  expirationDate?: Date;
  notes: string;
  category: string;
}

interface PantryItemFormProps {
  /** The pantry item being edited. This form is edit-only. */
  itemId: string;
  onSuccess?: () => void;
}

// A `decimal-pad` field: its keypad has no `/`, so it is seeded without one.
const decimalQuantityInput = (value: number | null | undefined): string =>
  formatQuantityForInput(value, { notation: 'decimal' });

const formValuesFromItem = (
  item: PantryItemForm_PantryItemFragment,
): PantryItemFormData => ({
  itemName: item.itemName,
  quantityInput: formatQuantityForInput(editedAmount(item).quantity) || '1',
  unit: editedAmount(item).unit.symbol,
  minQuantity: decimalQuantityInput(item.minQuantity),
  restockQuantity: decimalQuantityInput(item.restockQuantity),
  brand: item.brand?.name ?? '',
  netWeight: formatNumberForInput(item.netWeight),
  netWeightUnit: getUnitDisplayText(item.netWeightUnit),
  netWeightUnitId: item.netWeightUnit?.id ?? '',
  storageState: item.storageState,
  condition: item.condition,
  location: item.storageLocation?.name ?? '',
  expirationDate: item.expiresOn ? fromDateKey(item.expiresOn) : undefined,
  notes: item.storageNotes ?? '',
  category: item.item.categories[0]?.category.name ?? '',
  tags: item.tags,
});

/**
 * Edits an existing pantry item. Edit-only, deliberately: adding goes through
 * `AddToPantrySheet` → `AddDetailsSheet`, and a second create path here would
 * be a second set of cache writes to keep offline-correct.
 */
export const PantryItemForm: React.FC<PantryItemFormProps> = ({
  itemId,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();

  const [trackingUnit, setTrackingUnit] =
    useState<UnitSelection>(emptyUnitSelection);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [selectedStorageLocation, setSelectedStorageLocation] = useState<{
    id: string;
    name: string;
    type: StorageType;
  } | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(0);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const selectedPantryId = useSelectedPantryId();
  const selectedHomeId = useSelectedHomeId();

  const {
    existingPantryItem,
    itemQueryData,
    isUnconfirmed,
    currentPantryId,
    storageLocations,
    itemLoading,
    refetchItem,
  } = usePantryItemFormData({ itemId, selectedHomeId, selectedPantryId });

  const { updatePantryItemFields } = useUpdatePantryItem({
    refetch: () => {
      void refetchItem();
    },
  });

  const { updateQuantity } = useUpdatePantryItemQuantity({
    refetch: () => {
      void refetchItem();
    },
  });

  const { resolveUnitId } = useResolveUnit();

  const getInitialValues = (): PantryItemFormData => {
    if (existingPantryItem) {
      return formValuesFromItem(existingPantryItem);
    }

    // Not loaded yet — the form shows a spinner until it is.
    return {
      itemName: '',
      brand: '',
      quantityInput: '1',
      unit: '', // Tracking unit
      minQuantity: '',
      restockQuantity: '',
      netWeight: '',
      netWeightUnit: '',
      netWeightUnitId: '',
      storageState: StorageState.Ambient,
      condition: ItemCondition.Good,
      location: '',
      notes: '',
      category: '',
    };
  };

  const {
    control,
    handleSubmit,
    formState: { errors, dirtyFields },
    setValue,
    setError,
    reset,
    trigger,
  } = useForm<PantryItemFormData>({
    resolver: yupResolver(editItemSchema) as Resolver<PantryItemFormData>,
    defaultValues: getInitialValues(),
    mode: 'onChange',
  });

  const watchedValues = useWatch({ control });

  // "Adjusting state during render" pattern — avoids setState-in-useEffect lint error
  const [prevExistingItemData, setPrevExistingItemData] =
    useState<typeof itemQueryData>();
  if (existingPantryItem && itemQueryData !== prevExistingItemData) {
    setPrevExistingItemData(itemQueryData);
    const item = existingPantryItem;
    reset(formValuesFromItem(item));
    const { unit } = editedAmount(item);
    setTrackingUnit({
      id: unit.id,
      name: unit.name,
      symbol: unit.symbol,
      type: unit.type,
    });
  }

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
  };

  const handleStorageLocationSelect = (
    locationId: string | null,
    location: StorageLocationOption | null,
  ) => {
    setSelectedLocationId(locationId);
    setSelectedStorageLocation(
      locationId && location
        ? { id: locationId, name: location.name, type: location.type }
        : null,
    );
    // `NONE` is "not applicable", so it leaves the chosen state alone.
    if (location?.temperature && location.temperature !== StorageState.None) {
      setValue('storageState', location.temperature, { shouldDirty: true });
    }
  };

  // The save mutation find-or-creates the location by name, so record the typed
  // name and clear the selected id. Creating it eagerly instead would orphan a
  // location whenever the user cancels the edit.
  const handleAddNewLocation = (name: string) => {
    setValue('location', name, { shouldDirty: true });
    setSelectedLocationId(null);
  };

  const handleUnitSelected = (
    unitId: string | null,
    unitName: string | null,
    unitType?: UnitType | null,
    unitSymbol?: string | null,
  ) => {
    setTrackingUnit(prev => ({
      ...prev,
      id: unitId,
      name: unitName,
      type: unitType ?? null,
      symbol: unitSymbol ?? null,
    }));
  };

  // The all-or-nothing net-weight rule reports on `netWeightUnit` while its
  // inputs are `netWeight` and `netWeightUnitId`, so writing either half has to
  // re-run both — `shouldValidate` re-runs only the field it wrote.
  const revalidateNetWeight = () => {
    void trigger(['netWeightUnit', 'netWeight']);
  };

  const handleNetWeightUnitSelected = (unitId: string | null) => {
    setValue('netWeightUnitId', unitId ?? '', { shouldDirty: true });
    revalidateNetWeight();
  };

  const item = existingPantryItem;

  const unitChange = usePantryUnitChange();

  const { handleSave } = usePantryItemFormSubmit({
    itemId,
    currentPantryId,
    existingPantryItem,
    dirtyFields: dirtyFields,
    trackingUnit,
    netWeightUnitId: firstNonBlank(watchedValues.netWeightUnitId) ?? null,
    selectedLocationId,
    selectedBrandId,
    selectedCategoryId,
    selectedStorageLocation,
    updatePantryItemFields,
    updateQuantity,
    resolveUnitId,
    unitChange: {
      preview: request =>
        unitChange.preview({ ...request, pantryItemId: itemId }),
      change: request =>
        unitChange.change({ ...request, pantryItemId: itemId }),
    },
    reportFieldError: (field, message) => {
      setCurrentPage(PAGES.findIndex(page => TAB_FIELDS[page].includes(field)));
      setError(field, { type: 'server', message }, { shouldFocus: false });
    },
    onSuccess,
  });

  // Cache first: a locally created item is readable before any round trip, so
  // spin only when there is genuinely nothing to show. `isUnconfirmed` counts
  // as loading, not missing — the create is in flight.
  const [isSaving, setIsSaving] = useState(false);
  const submit = async () => {
    setIsSaving(true);
    await handleSubmit(handleSave, logValidationErrors)();
    setIsSaving(false);
  };
  const save = () => {
    void submit();
  };
  const shell = (children: React.ReactNode, canSave = true) => (
    <FormScreen
      title={t('itemForm.editTitle')}
      onClose={() => goBack()}
      onSave={save}
      canSave={canSave}
      loading={isSaving}
      testID={pantryTestIDs.editItemModal}
      submitButtonTestID={pantryTestIDs.editItemSubmitButton}
    >
      {children}
    </FormScreen>
  );

  // Cache first: a locally created item is readable before any round trip, so
  // spin only when there is genuinely nothing to show. `isUnconfirmed` counts
  // as loading, not missing — the create is in flight.
  if (!existingPantryItem && (itemLoading || isUnconfirmed)) {
    return shell(
      <View style={styles.state}>
        <PrimaryActivityIndicator size="large" />
      </View>,
      false,
    );
  }

  if (!existingPantryItem) {
    return shell(
      <View style={styles.state}>
        <Text role="error" tone="error">
          {t('errors.itemNotFound')}
        </Text>
      </View>,
      false,
    );
  }

  const tagsFields: FieldDef<PantryItemFormData>[] = [
    {
      name: 'tags',
      label: t('itemForm.tags'),
      placeholder: t('itemForm.tagsPlaceholder'),
      component: FormInput,
      renderValue: (value: unknown) =>
        Array.isArray(value)
          ? value.join(', ')
          : typeof value === 'string'
          ? value
          : '',
      transformValue: (value: unknown) => {
        const text = Array.isArray(value)
          ? value.join(',')
          : typeof value === 'string'
          ? value
          : '';
        return text
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean);
      },
      transformOnBlur: true,
    },
  ];

  // Drives the red dot on PageIndicator, and auto-expands "More options" when
  // an errored field lives inside it.
  const fieldHasError = (name: keyof PantryItemFormData) => !!errors[name];
  const tabHasError = (page: PageName) => {
    const fields =
      page === 'Inventory'
        ? [...TAB_FIELDS.Inventory, ...INVENTORY_ADVANCED_FIELDS]
        : TAB_FIELDS[page];
    return fields.some(fieldHasError);
  };
  const inventoryAdvancedHasError =
    INVENTORY_ADVANCED_FIELDS.some(fieldHasError);
  const showTags = tagsExpanded || inventoryAdvancedHasError;
  // `page` is the identifier, not the copy — resolve it to a label key.
  const indicatorPages = PAGES.map(page => ({
    label: t(PAGE_LABEL_KEYS[page]),
    hasError: tabHasError(page),
  }));

  return shell(
    <>
      <PageIndicator
        pages={indicatorPages}
        currentPage={currentPage}
        onPagePress={setCurrentPage}
      />

      <View style={styles.pageContent}>
        {currentPage === 0 && (
          <ItemInformationSection
            control={control}
            errors={errors}
            onBrandSelected={setSelectedBrandId}
            onCategorySelected={handleCategorySelect}
          />
        )}

        {currentPage === 1 && (
          <NetWeightSection
            control={control}
            onNetWeightChanged={revalidateNetWeight}
            onNetWeightUnitSelected={handleNetWeightUnitSelected}
          />
        )}

        {currentPage === 2 && (
          <StorageDetailsSection
            control={control}
            errors={errors}
            storageState={watchedValues.storageState ?? StorageState.Ambient}
            condition={watchedValues.condition ?? ItemCondition.Good}
            expirationDate={watchedValues.expirationDate}
            onStorageStateChange={state =>
              setValue('storageState', state, { shouldDirty: true })
            }
            onConditionChange={c =>
              setValue('condition', c, { shouldDirty: true })
            }
            onDateChange={date => {
              setValue('expirationDate', date ?? undefined, {
                shouldDirty: true,
              });
            }}
            storageLocations={storageLocations}
            onStorageLocationSelected={handleStorageLocationSelect}
            onAddNewLocation={handleAddNewLocation}
          />
        )}

        {currentPage === 3 && (
          <>
            <QuantitySection
              control={control}
              onUnitSelected={handleUnitSelected}
              testID={pantryTestIDs.editItemQuantityInput}
              unitTestID={pantryTestIDs.editItemUnitPicker}
              unitSymbol={item?.unit.symbol}
            />

            <CollapsibleSection
              title={t('labels.moreOptions')}
              expanded={showTags}
              onToggle={() => setTagsExpanded(prev => !prev)}
            >
              <View style={styles.advancedContent}>
                <DynamicFormFields
                  fields={tagsFields}
                  control={control}
                  errors={errors}
                />
              </View>
            </CollapsibleSection>
          </>
        )}
      </View>
    </>,
  );
};

const styles = StyleSheet.create(theme => ({
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageContent: {
    paddingTop: theme.spacing.md,
  },
  advancedContent: {
    paddingTop: theme.spacing.md,
  },
}));
