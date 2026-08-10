import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { Text } from '#components/atoms/Text';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';
import { useNavigation } from '@react-navigation/native';
import { commonStyles } from '#/styles/commonStyles';
import { useSelectedPantryId, useSelectedHomeId } from '#store/useAppStore';
import { extractNodes } from '#/utils/connectionUtils';
import { useApolloClient, useQuery } from '@apollo/client/react';
import { GetHomeDocument } from '#operations/home/home.generated';
import {
  GetPantryDocument,
  GetPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  PantryItemForm_PantryItemFragmentDoc,
  type PantryItemForm_PantryItemFragment,
  PantryItemForm_HomeFragmentDoc,
  type PantryItemForm_HomeFragment,
} from './PantryItemForm.generated';
import {
  StorageState,
  ItemCondition,
  type ItemSuggestion,
  type StorageLocation,
} from '#/graphql/generated/schemaTypes';
import { useCreatePantryItem } from '#features/pantry/hooks/mutations/useCreatePantryItem';
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
import { FormInput } from '#components/molecules/FormInput';
import { Header } from '#components/molecules/Header';
import { PageIndicator } from '#components/molecules/PageIndicator/PageIndicator';
import { CollapsibleSection } from '#components/molecules/CollapsibleSection';
import { ItemInformationSection } from './ItemInformationSection';
import { QuantitySection } from './QuantitySection';
import { StorageDetailsSection } from './StorageDetailsSection';
import { NetWeightSection } from './NetWeightSection';
import { usePantryItemFormSubmit } from './usePantryItemFormSubmit';
import { logValidationErrors } from '#utils/validation/common';
import {
  type PageName,
  PAGES,
  TAB_FIELDS,
  INVENTORY_ADVANCED_FIELDS,
  addItemSchema,
  editItemSchema,
} from './pantryItemFormConfig';

export interface PantryItemFormData {
  // Item information (add mode)
  itemName?: string;
  selectedItemId?: string;
  brand?: string;

  // Quantity fields (both modes)
  quantityInput?: string;
  unit: string; // Tracking unit (for counting items)

  // Edit mode specific
  tags?: string[];

  // Low stock settings (both modes)
  minQuantity?: string;
  restockQuantity?: string;

  // Net weight
  netWeight?: string;
  netWeightUnit?: string;
  netWeightUnitId?: string;

  // Storage fields (both modes)
  storageState: StorageState;
  condition: ItemCondition;
  location: string;
  expirationDate?: Date;
  notes: string;
  category: string;
}

interface PantryItemFormProps {
  mode: 'add' | 'edit';
  itemId?: string; // Required for edit mode
  onSuccess?: () => void;
}

export const PantryItemForm: React.FC<PantryItemFormProps> = ({
  mode,
  itemId,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { goBack } = useNavigation();

  // Consolidated unit state using UnitSelection type
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
  const [suggestedBrands, setSuggestedBrands] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [netWeightUnitId, setNetWeightUnitId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(0);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const selectedPantryId = useSelectedPantryId();
  // Get selectedHomeId from Zustand (no GraphQL query triggered)
  const selectedHomeId = useSelectedHomeId();

  // Helper to get default pantry (inline to avoid useDefaultHome dependency)
  const getDefaultPantry = (home: PantryItemForm_HomeFragment | null) => {
    const pantries = extractNodes(home?.pantriesConnection);
    if (!pantries.length) return null;
    return pantries.find(p => p.isDefault) ?? pantries[0] ?? null;
  };

  const { data: homeData } = useQuery(GetHomeDocument, {
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId,
  });

  // Load existing item for edit mode
  const {
    data: existingItemData,
    loading: itemLoading,
    refetch: refetchItem,
  } = useQuery(GetPantryItemDocument, {
    variables: { id: itemId ?? '' },
    skip: mode !== 'edit' || !itemId,
  });

  // Materialize the form's own narrow fragment from the cache. The screen's
  // `GetPantryItem` query selects this fragment via `...PantryItemForm_pantryItem`
  // in `PantryItemDetail_pantryItem`, so the cache is already populated.
  const apolloClient = useApolloClient();
  const existingPantryItem = existingItemData?.pantryItem
    ? apolloClient.cache.readFragment<PantryItemForm_PantryItemFragment>({
        fragment: PantryItemForm_PantryItemFragmentDoc,
        fragmentName: 'PantryItemForm_pantryItem',
        from: existingItemData.pantryItem,
      })
    : null;

  // Resolve the masked `home` ref to the form's own fragment so we can read
  // pantriesConnection (data masking hides it on the raw query result).
  const home = homeData?.home
    ? apolloClient.cache.readFragment<PantryItemForm_HomeFragment>({
        fragment: PantryItemForm_HomeFragmentDoc,
        fragmentName: 'PantryItemForm_home',
        from: homeData.home,
      })
    : null;
  const pantry = getDefaultPantry(home);
  const currentPantryId =
    selectedPantryId || pantry?.id || existingPantryItem?.pantryId;

  // Fetch pantry details to get storage locations
  const { data: pantryData } = useQuery(GetPantryDocument, {
    variables: { id: currentPantryId ?? '' },
    skip: !currentPantryId,
    fetchPolicy: 'cache-first',
  });

  const storageLocations = extractNodes(
    pantryData?.pantry?.storageLocationsConnection,
  ) as StorageLocation[];

  // Mutation hooks - modular pattern for maintainability
  const { createPantryItem } = useCreatePantryItem({
    pantryId: currentPantryId,
    onSuccess,
  });

  const { updatePantryItemFields } = useUpdatePantryItem({
    onSuccess,
    refetch: refetchItem,
  });

  const { updateQuantity } = useUpdatePantryItemQuantity({
    onSuccess,
    refetch: refetchItem,
  });

  const { resolveUnitId } = useResolveUnit();

  // Get initial values based on mode
  const getInitialValues = (): PantryItemFormData => {
    if (mode === 'edit' && existingPantryItem) {
      const item = existingPantryItem;
      // Tracking unit (for counting items) - from item.unit or item.unitName
      const trackingUnitSymbol = item.unit?.symbol || '';
      return {
        itemName: item.itemName || '',
        quantityInput: item.quantity?.toString() || '1',
        unit: trackingUnitSymbol, // Tracking unit
        minQuantity: item.minQuantity?.toString() || '',
        restockQuantity: item.restockQuantity?.toString() || '',
        brand: item.brand?.name || '',
        netWeight: item.netWeight?.toString() || '',
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

    // Add mode defaults
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
    resolver: (mode === 'add'
      ? yupResolver(addItemSchema)
      : yupResolver(editItemSchema)) as Resolver<PantryItemFormData>,
    defaultValues: getInitialValues(),
    mode: 'onChange',
  });

  const watchedValues = useWatch({ control });

  // "Adjusting state during render" pattern — avoids setState-in-useEffect lint error
  const [prevExistingItemData, setPrevExistingItemData] =
    useState<typeof existingItemData>();
  if (
    mode === 'edit' &&
    existingPantryItem &&
    existingItemData !== prevExistingItemData
  ) {
    setPrevExistingItemData(existingItemData);
    const item = existingPantryItem;
    const trackingUnitSymbol = item.unit?.symbol || '';
    reset({
      itemName: item.itemName || '',
      quantityInput: item.quantity?.toString() || '1',
      unit: trackingUnitSymbol,
      minQuantity: item.minQuantity?.toString() || '',
      restockQuantity: item.restockQuantity?.toString() || '',
      brand: item.brand?.name || '',
      netWeight: item.netWeight?.toString() || '',
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
    // Initialize tracking unit state from existing item
    if (item.unit) {
      setTrackingUnit({
        id: item.unit.id,
        name: item.unit.name,
        symbol: item.unit.symbol,
        type: item.unit.type ?? null,
      });
    }
    // Initialize net weight unit ID from existing item
    if (item.netWeightUnit?.id) {
      setNetWeightUnitId(item.netWeightUnit.id);
    }
  }

  // Handlers for item selection (add mode only)
  const handleItemSelect = (item: ItemSuggestion) => {
    setValue('itemName', item.name);
    setValue('selectedItemId', item.id);
    // Handle multiple brands - store all as suggestions, pre-populate with first
    if (item.brands && item.brands.length > 0) {
      setSuggestedBrands(item.brands);
      setValue('brand', item.brands[0].name);
    } else {
      setSuggestedBrands([]);
      setValue('brand', '');
    }
    if (item.category?.name) {
      setValue('category', item.category.name);
      setSelectedCategoryId(null);
    }
    // Set tracking unit from item's default unit
    if (item.defaultUnit?.symbol) {
      setValue('unit', item.defaultUnit.symbol);
      setTrackingUnit({
        id: item.defaultUnit.id || null,
        name: item.defaultUnit.name || null,
        symbol: item.defaultUnit.symbol || null,
        type: null,
      });
    }
  };

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

  // Handler for adding a new storage location (user typed a custom name).
  // createPantryItem and updatePantryItem both find-or-create the location by
  // name on save (case-insensitive within the home, else a new CUSTOM location)
  // and return its id — so just record the typed name and clear any selected
  // id. Creating it server-side on save (vs eagerly) avoids orphaning a location
  // if the user cancels the edit.
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
  const isWeightLocked = mode === 'edit' && !!item?.lastUsedAt;

  const { handleSave } = usePantryItemFormSubmit({
    mode,
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
    createPantryItem,
    updatePantryItemFields,
    updateQuantity,
    resolveUnitId,
    onSuccess,
  });

  // Show loading for edit mode
  if (mode === 'edit' && itemLoading) {
    return (
      <View style={[commonStyles.container, commonStyles.center]}>
        <PrimaryActivityIndicator size="large" />
      </View>
    );
  }

  // Show error if edit mode but no item found
  if (mode === 'edit' && !existingPantryItem) {
    return (
      <View style={[commonStyles.container, commonStyles.center]}>
        <Text style={styles.errorText}>{t('itemForm.itemNotFound')}</Text>
      </View>
    );
  }

  // Tags section fields (edit mode only)
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

  const formTestID =
    mode === 'add' ? 'add-pantry-item-modal' : 'edit-pantry-item-modal';

  // Per-tab error detection — drives the red dot on PageIndicator and
  // auto-expansion of "More options" when an errored field lives inside it.
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
  const indicatorPages = PAGES.map(page => ({
    label: page,
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
          title={
            mode === 'add' ? t('itemForm.addTitle') : t('itemForm.editTitle')
          }
          onClose={() => goBack()}
          rightActions={[
            {
              icon: 'checkmark',
              onPress: handleSubmit(handleSave, logValidationErrors),
              variant: 'primary',
              testID:
                mode === 'add'
                  ? 'add-pantry-item-submit-button'
                  : 'edit-pantry-item-submit-button',
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
            {currentPage === 0 &&
              (mode === 'add' ? (
                <ItemInformationSection
                  control={control}
                  errors={errors}
                  mode="add"
                  onSelectItem={handleItemSelect}
                  suggestedBrands={suggestedBrands}
                  testID="add-pantry-item-name-input"
                  onCategorySelected={handleCategorySelect}
                />
              ) : (
                <ItemInformationSection
                  control={control}
                  errors={errors}
                  mode="edit"
                  suggestedBrands={suggestedBrands}
                  onBrandSelected={setSelectedBrandId}
                  onCategorySelected={handleCategorySelect}
                />
              ))}

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
                mode={mode}
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
                  mode={mode}
                  onUnitSelected={handleUnitSelected}
                  testID={
                    mode === 'add'
                      ? 'add-pantry-item-quantity-input'
                      : 'edit-pantry-item-quantity-input'
                  }
                  unitTestID={
                    mode === 'add'
                      ? 'add-pantry-item-unit-picker'
                      : 'edit-pantry-item-unit-picker'
                  }
                  unitSymbol={item?.unit?.symbol}
                />

                {mode === 'edit' && (
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
                )}
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
    fontSize: theme.fonts.size.lg,
    color: theme.colors.error,
  },
  // Even page rhythm: matched side padding, a little room under the page
  // indicator, and generous space below the last field so it clears the
  // keyboard without feeling cramped.
  pageContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  advancedContent: {
    paddingTop: theme.spacing.md,
  },
}));
