import React, { useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  Text,
  ScrollView,
} from 'react-native';
import { useForm, useWatch, Controller, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object, string } from 'yup';
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
  PantryItemFragmentDoc,
  type PantryItemFragment,
} from '#features/pantry/graphql/pantryFragments.generated';
import {
  StorageState,
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
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { FieldRow } from '#components/molecules/FieldRow';
import { Header } from '#components/molecules/Header';
import { PageIndicator } from '#components/molecules/PageIndicator/PageIndicator';
import { CollapsibleSection } from '#components/molecules/CollapsibleSection';
import { ItemInformationSection } from './ItemInformationSection';
import { QuantitySection } from './QuantitySection';
import { StorageDetailsSection } from './StorageDetailsSection';
import { usePantryItemFormSubmit } from './usePantryItemFormSubmit';

type PageName = 'Basics' | 'Product' | 'Storage' | 'Inventory';
const PAGES: readonly PageName[] = [
  'Basics',
  'Product',
  'Storage',
  'Inventory',
];

// Maps each tab to the form field names it owns — drives per-tab error
// indicators on PageIndicator. Tags lives inside the Inventory "More options"
// expander.
const TAB_FIELDS: Record<PageName, readonly string[]> = {
  Basics: ['itemName', 'brand', 'category'],
  Product: ['netWeight', 'netWeightUnit'],
  Storage: ['storageState', 'location', 'expirationDate', 'notes'],
  Inventory: ['quantityInput', 'unit', 'minQuantity', 'restockQuantity'],
};
const INVENTORY_ADVANCED_FIELDS: readonly string[] = ['tags'];

interface PantryItemFormData {
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
  location: string;
  expirationDate?: Date;
  notes: string;
  category: string;
}

// Schema for add mode
const addItemSchema = object({
  itemName: string().required('Item name is required'),
  quantityInput: string().required('Quantity is required'),
  unit: string(), // Tracking unit
  minQuantity: string(),
  restockQuantity: string(),
  netWeight: string(),
  netWeightUnit: string(),
  netWeightUnitId: string(),
  storageState: string().oneOf(Object.values(StorageState)),
  location: string(),
  notes: string(),
  category: string(),
  brand: string(),
});

// Schema for edit mode
const editItemSchema = object({
  itemName: string(),
  quantityInput: string().required('Quantity is required'),
  unit: string(), // Tracking unit
  minQuantity: string(),
  restockQuantity: string(),
  netWeight: string(),
  netWeightUnit: string(),
  netWeightUnitId: string(),
  storageState: string().oneOf(Object.values(StorageState)),
  location: string(),
  notes: string(),
  category: string(),
  brand: string(),
});

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
  const getDefaultPantry = (data: any) => {
    const home = data?.home ?? data;
    const pantries = extractNodes(home?.pantriesConnection) as Array<{
      id: string;
      isDefault?: boolean;
    }>;
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

  // Materialize the masked PantryItemFragment ref into the full entity for
  // direct field access throughout the form. `cache.readFragment` reads from
  // the same normalized cache entry the `useQuery` subscription drives and
  // returns `Unmasked<PantryItemFragment>` so inner display fields are inlined.
  const apolloClient = useApolloClient();
  const existingPantryItem = existingItemData?.pantryItem
    ? apolloClient.cache.readFragment<PantryItemFragment>({
        fragment: PantryItemFragmentDoc,
        fragmentName: 'PantryItemFragment',
        from: existingItemData.pantryItem,
      })
    : null;

  const pantry = getDefaultPantry(homeData);
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
    location: any,
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

  // Handler for adding a new storage location (user typed a custom name)
  const handleAddNewLocation = (name: string) => {
    setValue('location', name, { shouldDirty: true });
    setSelectedLocationId(null); // Clear ID - will use name for server to find or create
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
        <Text style={styles.errorText}>Item not found</Text>
      </View>
    );
  }

  // Tags section fields (edit mode only)
  const tagsFields: FieldDef<PantryItemFormData>[] = [
    {
      name: 'tags' as any,
      label: 'Tags',
      placeholder: 'Enter tags separated by commas',
      component: FormInput,
      renderValue: (value: string[] | string) =>
        Array.isArray(value)
          ? value.join(', ')
          : typeof value === 'string'
          ? value
          : '',
      transformValue: (value: string) => {
        return value
          .split(',')
          .map(t => t.trim())
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
          title={mode === 'add' ? 'Add Pantry Item' : 'Edit Pantry Item'}
          onClose={() => goBack()}
          rightActions={[
            {
              icon: 'checkmark',
              onPress: handleSubmit(handleSave),
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
          <View style={commonStyles.padding}>
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
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Net Weight</Text>
                <Text style={styles.sectionDescription}>
                  Net weight is used for consumption tracking and is optional.
                </Text>
                <View
                  pointerEvents={isWeightLocked ? 'none' : 'auto'}
                  style={isWeightLocked ? styles.lockedSection : undefined}
                >
                  <FieldRow>
                    <Controller
                      control={control}
                      name="netWeight"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <FormInput
                          label="Net Weight"
                          value={value || ''}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          placeholder="e.g., 14.5"
                          keyboardType="decimal-pad"
                          editable={!isWeightLocked}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name="netWeightUnit"
                      render={({ field: { onChange, value } }) => (
                        <UnitAutocompleteField
                          variant="modal"
                          label="Unit"
                          value={value || ''}
                          onChangeText={onChange}
                          onUnitSelected={handleNetWeightUnitSelected}
                          placeholder="oz, g, ml"
                        />
                      )}
                    />
                  </FieldRow>
                </View>
                {!!isWeightLocked && (
                  <Text style={styles.lockedHint}>
                    Weight locked after use — correct from item details
                  </Text>
                )}
              </View>
            )}

            {currentPage === 2 && (
              <StorageDetailsSection
                control={control}
                errors={errors}
                mode={mode}
                storageState={
                  watchedValues.storageState ?? StorageState.Ambient
                }
                expirationDate={watchedValues.expirationDate}
                onStorageStateChange={state =>
                  setValue('storageState', state, { shouldDirty: true })
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
                    title="More options"
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
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  errorText: {
    fontSize: theme.fonts.size.lg,
    color: theme.colors.error,
  },
  sectionDescription: {
    fontSize: theme.fonts.size.sm,
    fontStyle: 'italic',
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.sm,
  },
  lockedSection: {
    opacity: theme.opacity.disabled,
  },
  lockedHint: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
  advancedContent: {
    paddingTop: theme.spacing.md,
  },
}));
