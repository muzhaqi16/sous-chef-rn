import React, { useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Text,
  ScrollView,
} from 'react-native';
import { alertService } from '#/services/alertService';
import { useForm, useWatch, Controller, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object, string } from 'yup';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useNavigation } from '@react-navigation/native';
import { commonStyles } from '#/styles/commonStyles';
import { useSelectedPantryId, useSelectedHomeId } from '#store/useAppStore';
import { normalizeHome } from '#/utils/connectionUtils';
import { useQuery } from '@apollo/client/react';
import { GetHomeDocument } from '../../graphql/operations/home/home.generated';
import {
  GetPantryDocument,
  GetPantryItemDocument,
} from '#operations/pantry/pantry.generated';
import {
  StorageState,
  type ItemSuggestion,
} from '#/graphql/generated/schemaTypes';
import { useCreatePantryItem } from '#hooks/pantry/mutations/useCreatePantryItem';
import { useUpdatePantryItem } from '#hooks/pantry/mutations/useUpdatePantryItem';
import { useUpdatePantryItemQuantity } from '#hooks/pantry/mutations/useUpdatePantryItemQuantity';
import { useResolveUnit } from '#hooks/pantry/mutations/useResolveUnit';
import {
  emptyUnitSelection,
  type UnitSelection,
} from '#hooks/pantry/mutations/types';
import { parseFractionalInput as parseQuantityInput } from '#/utils/fractionUtils';
import { normalizePantry } from '#/utils/connectionUtils';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
import { FormInput } from '#components/molecules/FormInput';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { FieldRow } from '#components/molecules/FieldRow';
import { Header } from '#components/molecules/Header';
import { ItemInformationSection } from './ItemInformationSection';
import { QuantitySection } from './QuantitySection';
import { StorageDetailsSection } from './StorageDetailsSection';
import { executeMutation } from '#/utils/compilerSafeWrappers';

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
  const { theme } = useUnistyles();
  const navigation = useNavigation();

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

  const selectedPantryId = useSelectedPantryId();
  // Get selectedHomeId from Zustand (no GraphQL query triggered)
  const selectedHomeId = useSelectedHomeId();

  // Helper to get default pantry (inline to avoid useDefaultHome dependency)
  const getDefaultPantry = (data: any) => {
    const normalized = normalizeHome(data?.home ?? data);
    if (!normalized?.pantries?.length) return null;
    return (
      normalized.pantries.find((p: any) => p.isDefault) ||
      normalized.pantries[0] ||
      null
    );
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

  const pantry = getDefaultPantry(homeData);
  const currentPantryId =
    selectedPantryId || pantry?.id || existingItemData?.pantryItem?.pantryId;

  // Fetch pantry details to get storage locations
  const { data: pantryData } = useQuery(GetPantryDocument, {
    variables: { id: currentPantryId ?? '' },
    skip: !currentPantryId,
    fetchPolicy: 'cache-first',
  });

  const normalizedPantry = pantryData?.pantry
    ? normalizePantry(pantryData.pantry)
    : null;
  const storageLocations = normalizedPantry?.storageLocations || [];

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
    if (mode === 'edit' && existingItemData?.pantryItem) {
      const item = existingItemData.pantryItem;
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
    existingItemData?.pantryItem &&
    existingItemData !== prevExistingItemData
  ) {
    setPrevExistingItemData(existingItemData);
    const item = existingItemData.pantryItem;
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

  const handleSave = (data: PantryItemFormData) => {
    // Validate quantity input
    const quantityValue = parseQuantityInput(data.quantityInput || '');
    if (!quantityValue || quantityValue <= 0) {
      alertService.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (!currentPantryId) {
      alertService.alert(
        'Error',
        'No pantry selected. Please select a pantry first.',
      );
      return;
    }

    executeMutation(
      async () => {
        // Resolve unit ID from symbol if needed
        const unitId =
          trackingUnit.id ?? (await resolveUnitId(null, data.unit));

        // Resolve net weight unit from symbol text if needed (skip if weight locked)
        const netWeightUnitText = (data.netWeightUnit || '').trim();
        if (!isWeightLocked && netWeightUnitText) {
          const resolvedNetWeightUnitId =
            netWeightUnitId ?? (await resolveUnitId(null, netWeightUnitText));
          if (resolvedNetWeightUnitId) {
            data.netWeightUnitId = resolvedNetWeightUnitId;
          }
        }

        if (mode === 'add') {
          await createPantryItem({
            input: data,
            pantryId: currentPantryId,
            quantityValue,
            unitId,
            selectedLocationId,
            selectedCategoryId,
          });
        } else {
          const currentItem = existingItemData?.pantryItem;
          if (!currentItem || !itemId) {
            alertService.alert('Error', 'Item not found');
            return;
          }

          const dirtyFieldsRecord = { ...dirtyFields } as Record<
            string,
            boolean
          >;

          // Strip weight fields when locked — weight changes must go through correctPantryItemWeight
          if (isWeightLocked) {
            delete dirtyFieldsRecord.netWeight;
            delete dirtyFieldsRecord.netWeightUnitId;
          }

          // Detect unit change even if dirtyFields missed it (e.g. typed without autocomplete)
          const currentUnitSymbol = currentItem.unit?.symbol || '';
          const typedUnit = (data.unit || '').trim();
          if (typedUnit && typedUnit !== currentUnitSymbol) {
            dirtyFieldsRecord.unit = true;
          }

          const quantityChanged = !!dirtyFieldsRecord.quantityInput;
          const unitChanged = !!dirtyFieldsRecord.unit;
          const unitChangedWithoutId = unitChanged && !unitId;

          const hasNonQuantityChanges = Object.keys(dirtyFieldsRecord).some(
            k => k !== 'quantityInput' && k !== 'unit' && dirtyFieldsRecord[k],
          );

          // Handle quantity/unit changes with dedicated mutation
          // Skip unit via this path when unitId is null — route through updatePantryItemFields instead
          if (quantityChanged || (unitChanged && !unitChangedWithoutId)) {
            updateQuantity({
              itemId,
              quantityInput: data.quantityInput || quantityValue.toString(),
              quantityValue,
              unitId: unitChangedWithoutId ? null : unitId,
              unitSymbol: data.unit,
              trackingUnit,
              currentItem,
            });
          }

          // Handle non-quantity field updates
          // Also route unit changes here when unitId is null (UnitSpecInput supports unitSymbol)
          if (hasNonQuantityChanges || unitChangedWithoutId) {
            updatePantryItemFields({
              itemId,
              input: data,
              currentItem,
              dirtyFields: dirtyFieldsRecord,
              selectedLocationId,
              selectedBrandId,
              trackingUnit:
                quantityChanged || unitChanged ? trackingUnit : undefined,
              selectedStorageLocation,
              unitSymbol: unitChangedWithoutId ? data.unit : undefined,
            });
          } else if (!quantityChanged && !unitChanged) {
            // Nothing changed — still dismiss the form
            onSuccess?.();
          }
        }
      },
      error => {
        console.error(
          `${mode === 'add' ? 'Add' : 'Update'} pantry item error:`,
          error,
        );
        alertService.alert(
          'Error',
          `Failed to ${
            mode === 'add' ? 'add' : 'update'
          } pantry item. Please try again.`,
        );
      },
    );
  };

  // Show loading for edit mode
  if (mode === 'edit' && itemLoading) {
    return (
      <View style={[commonStyles.container, commonStyles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Show error if edit mode but no item found
  if (mode === 'edit' && !existingItemData?.pantryItem) {
    return (
      <View style={[commonStyles.container, commonStyles.center]}>
        <Text style={styles.errorText}>Item not found</Text>
      </View>
    );
  }

  const item = existingItemData?.pantryItem;
  const isWeightLocked = mode === 'edit' && !!item?.lastUsedAt;

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

  return (
    <View testID={formTestID} style={styles.container}>
      <KeyboardAvoidingView
        style={commonStyles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Header
          variant="form"
          title={mode === 'add' ? 'Add Pantry Item' : 'Edit Pantry Item'}
          onClose={() => navigation.goBack()}
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

        <ScrollView
          style={commonStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={commonStyles.padding}>
            {/* Item Information Section */}
            {mode === 'add' ? (
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
            )}

            {/* Quantity Section */}
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
              // Edit mode stock info (read-only display)
              unitSymbol={item?.unit?.symbol}
            />

            {/* Net Weight Section */}
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

            {/* Storage Details Section */}
            <StorageDetailsSection
              control={control}
              errors={errors}
              mode={mode}
              storageState={watchedValues.storageState ?? StorageState.Ambient}
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

            {/* Tags Section (Edit mode only) */}
            {mode === 'edit' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tags</Text>
                <DynamicFormFields
                  fields={tagsFields}
                  control={control}
                  errors={errors}
                />
              </View>
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
}));
