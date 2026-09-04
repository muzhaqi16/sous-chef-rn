import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { Text } from '#components/atoms/Text';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';

import { commonStyles } from '#/styles/commonStyles';
import { useSelectedPantryId, useSelectedHomeId } from '#store/useAppStore';
import { usePantryItemFormData } from '#features/pantry/hooks/usePantryItemFormData';
import {
  StorageState,
  ItemCondition,
  type StorageLocation,
} from '#/graphql/generated/schemaTypes';
import { useUpdatePantryItem } from '#features/pantry/hooks/mutations/useUpdatePantryItem';
import { useUpdatePantryItemQuantity } from '#features/pantry/hooks/mutations/useUpdatePantryItemQuantity';
import { useResolveUnit } from '#features/pantry/hooks/mutations/useResolveUnit';
import {
  emptyUnitSelection,
  type UnitSelection,
} from '#features/pantry/hooks/mutations/types';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
import { FormInput } from '#components/atoms/FormInput';
import { Header } from '#components/organisms/Header';
import { PageIndicator } from '#components/molecules/PageIndicator/PageIndicator';
import { CollapsibleSection } from '#components/molecules/CollapsibleSection';
import { ItemInformationSection } from './ItemInformationSection';
import { QuantitySection } from './QuantitySection';
import { StorageDetailsSection } from './StorageDetailsSection';
import { NetWeightSection } from './NetWeightSection';
import { usePantryItemFormSubmit } from './usePantryItemFormSubmit';
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
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';

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
    type: string;
  } | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [netWeightUnitId, setNetWeightUnitId] = useState<string | null>(null);

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
    onSuccess,
    refetch: refetchItem,
  });

  const { updateQuantity } = useUpdatePantryItemQuantity({
    onSuccess,
    refetch: refetchItem,
  });

  const { resolveUnitId } = useResolveUnit();

  const getInitialValues = (): PantryItemFormData => {
    if (existingPantryItem) {
      const item = existingPantryItem;
      const trackingUnitSymbol = item.unit?.symbol || '';
      return {
        itemName: item.itemName || '',
        quantityInput: formatNumberForInput(item.quantity) || '1',
        unit: trackingUnitSymbol, // Tracking unit
        minQuantity: formatNumberForInput(item.minQuantity),
        restockQuantity: formatNumberForInput(item.restockQuantity),
        brand: item.brand?.name || '',
        netWeight: formatNumberForInput(item.netWeight),
        netWeightUnit:
          item.netWeightUnit?.symbol || item.netWeightUnit?.name || '',
        netWeightUnitId: item.netWeightUnit?.id || '',
        storageState: item.storageState || StorageState.Ambient,
        condition: item.condition || ItemCondition.Good,
        location:
          typeof item.storageLocation === 'string'
            ? item.storageLocation
            : item.storageLocation?.name || '',
        expirationDate: item.expiresAt ? new Date(item.expiresAt) : undefined,
        notes: item.storageNotes || '',
        category: item.item?.categories?.[0]?.category?.name || '',
        tags: item.tags || [],
      };
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
    reset,
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
    const trackingUnitSymbol = item.unit?.symbol || '';
    reset({
      itemName: item.itemName || '',
      quantityInput: formatNumberForInput(item.quantity) || '1',
      unit: trackingUnitSymbol,
      minQuantity: formatNumberForInput(item.minQuantity),
      restockQuantity: formatNumberForInput(item.restockQuantity),
      brand: item.brand?.name || '',
      netWeight: formatNumberForInput(item.netWeight),
      netWeightUnit:
        item.netWeightUnit?.symbol || item.netWeightUnit?.name || '',
      netWeightUnitId: item.netWeightUnit?.id || '',
      storageState: item.storageState || StorageState.Ambient,
      condition: item.condition || ItemCondition.Good,
      location:
        typeof item.storageLocation === 'string'
          ? item.storageLocation
          : item.storageLocation?.name || '',
      expirationDate: item.expiresAt ? new Date(item.expiresAt) : undefined,
      notes: item.storageNotes || '',
      category: item.item?.categories?.[0]?.category?.name || '',
      tags: item.tags || [],
    });
    if (item.unit) {
      setTrackingUnit({
        id: item.unit.id,
        name: item.unit.name,
        symbol: item.unit.symbol,
        type: item.unit.type ?? null,
      });
    }
    if (item.netWeightUnit?.id) {
      setNetWeightUnitId(item.netWeightUnit.id);
    }
  }

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
  };

  const handleStorageLocationSelect = (
    locationId: string | null,
    location: StorageLocation | null,
  ) => {
    setSelectedLocationId(locationId);
    setSelectedStorageLocation(
      locationId && location
        ? { id: locationId, name: location.name, type: location.type }
        : null,
    );

    if (location?.temperature) {
      const tempLower = location.temperature.toLowerCase();
      if (tempLower === 'frozen') {
        setValue('storageState', StorageState.Frozen, { shouldDirty: true });
      } else if (tempLower === 'refrigerated') {
        setValue('storageState', StorageState.Refrigerated, {
          shouldDirty: true,
        });
      } else if (tempLower === 'ambient') {
        setValue('storageState', StorageState.Ambient, { shouldDirty: true });
      }
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
    unitType?: string | null,
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

  const handleNetWeightUnitSelected = (unitId: string | null) => {
    setNetWeightUnitId(unitId);
  };

  const item = existingPantryItem;
  const isWeightLocked = !!item?.lastUsedAt;

  const { handleSave } = usePantryItemFormSubmit({
    itemId,
    currentPantryId,
    isWeightLocked,
    existingPantryItem,
    dirtyFields: dirtyFields as Record<string, unknown>,
    trackingUnit,
    netWeightUnitId,
    selectedLocationId,
    selectedBrandId,
    selectedCategoryId,
    selectedStorageLocation,
    updatePantryItemFields,
    updateQuantity,
    resolveUnitId,
    onSuccess,
  });

  // Cache first: a locally created item is readable before any round trip, so
  // spin only when there is genuinely nothing to show. `isUnconfirmed` counts
  // as loading, not missing — the create is in flight.
  if (!existingPantryItem && (itemLoading || isUnconfirmed)) {
    return (
      <View style={[commonStyles.container, commonStyles.center]}>
        <PrimaryActivityIndicator size="large" />
      </View>
    );
  }

  if (!existingPantryItem) {
    return (
      <View style={[commonStyles.container, commonStyles.center]}>
        <Text role="heading" style={styles.errorText}>
          {t('errors.itemNotFound')}
        </Text>
      </View>
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
        return String(value ?? '')
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean);
      },
      transformOnBlur: true,
    },
  ];

  const formTestID = 'edit-pantry-item-modal';

  // Drives the red dot on PageIndicator, and auto-expands "More options" when
  // an errored field lives inside it.
  const fieldHasError = (name: string) =>
    !!(errors as Record<string, unknown>)[name];
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

  return (
    <View testID={formTestID} style={styles.container}>
      <KeyboardAvoidingView
        style={commonStyles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Header
          variant="form"
          title={t('itemForm.editTitle')}
          onClose={() => goBack()}
          rightActions={[
            {
              icon: 'checkmark',
              accessibilityLabel: t('labels.save'),
              onPress: handleSubmit(handleSave, logValidationErrors),
              variant: 'primary',
              testID: 'edit-pantry-item-submit-button',
            },
          ]}
        />

        <PageIndicator
          pages={indicatorPages}
          currentPage={currentPage}
          onPagePress={setCurrentPage}
        />

        <ScrollView
          style={commonStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
                isWeightLocked={isWeightLocked}
                onNetWeightUnitSelected={handleNetWeightUnitSelected}
              />
            )}

            {currentPage === 2 && (
              <StorageDetailsSection
                control={control}
                errors={errors}
                storageState={
                  watchedValues.storageState ?? StorageState.Ambient
                }
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
                  errors={errors}
                  onUnitSelected={handleUnitSelected}
                  testID="edit-pantry-item-quantity-input"
                  unitTestID="edit-pantry-item-unit-picker"
                  unitSymbol={item?.unit?.symbol}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  errorText: {
    color: theme.colors.error,
  },
  // Generous bottom padding so the last field clears the keyboard.
  pageContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  advancedContent: {
    paddingTop: theme.spacing.md,
  },
}));
