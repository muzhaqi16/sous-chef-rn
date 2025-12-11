import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useNavigation } from '@react-navigation/native';

import { commonStyles } from '#/styles/commonStyles';
import { useDefaultHome } from '#hooks';
import { useAppStore, selectSelectedPantryId } from '#store/useAppStore';
import {
  StorageState,
  useCreatePantryItemMutation,
  useUpdatePantryItemMutation,
  useUpdatePantryItemQuantityMutation,
  useGetPantryItemQuery,
  useGetHomeQuery,
  useGetPantryQuery,
  useGetUnitBySymbolLazyQuery,
  ItemSuggestion,
} from '#generated';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { normalizePantry } from '#/utils/connectionUtils';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
import { FormInput } from '#components/molecules/FormInput';
import { Header } from '#components/molecules/Header';
import { ItemInformationSection } from './ItemInformationSection';
import { QuantitySection } from './QuantitySection';
import { StorageDetailsSection } from './StorageDetailsSection';

interface PantryItemFormData {
  // Item information (add mode)
  itemName?: string;
  selectedItemId?: string;
  brand?: string;

  // Quantity fields (both modes)
  quantityInput?: string;
  unit: string; // Tracking unit (for counting items)

  // Weight fields (both modes) - separate from tracking unit
  itemWeight?: number;
  weightUnit?: string; // Weight unit (for physical weight measurement)

  // Edit mode specific
  tags?: string[];

  // Low stock settings (both modes)
  minQuantity?: string;
  restockQuantity?: string;

  // Storage fields (both modes)
  storageState: StorageState;
  location: string;
  expirationDate?: Date;
  notes: string;
  category: string;
}

// Schema for add mode
const addItemSchema = yup.object({
  itemName: yup.string().required('Item name is required'),
  quantityInput: yup.string().required('Quantity is required'),
  unit: yup.string(), // Tracking unit
  itemWeight: yup
    .number()
    .positive('Item weight must be positive')
    .nullable()
    .transform((value, originalValue) => (originalValue === '' ? null : value)),
  weightUnit: yup.string(), // Weight unit (separate from tracking unit)
  minQuantity: yup.string(),
  restockQuantity: yup.string(),
  storageState: yup.string().oneOf(Object.values(StorageState)),
  location: yup.string(),
  notes: yup.string(),
  category: yup.string(),
  brand: yup.string(),
});

// Schema for edit mode
const editItemSchema = yup.object({
  quantityInput: yup.string().required('Quantity is required'),
  unit: yup.string(), // Tracking unit
  itemWeight: yup
    .number()
    .positive('Item weight must be positive')
    .nullable()
    .transform((value, originalValue) => (originalValue === '' ? null : value)),
  weightUnit: yup.string(), // Weight unit (separate from tracking unit)
  minQuantity: yup.string(),
  restockQuantity: yup.string(),
  storageState: yup.string().oneOf(Object.values(StorageState)),
  location: yup.string(),
  notes: yup.string(),
  category: yup.string(),
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
  const [_saving, setSaving] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [_selectedUnitName, setSelectedUnitName] = useState<string | null>(null);
  const [selectedUnitType, setSelectedUnitType] = useState<string | null>(null);
  const [selectedWeightUnitId, setSelectedWeightUnitId] = useState<string | null>(null);
  const [_selectedWeightUnitName, setSelectedWeightUnitName] = useState<string | null>(null);
  const [selectedWeightUnitType, setSelectedWeightUnitType] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [suggestedBrands, setSuggestedBrands] = useState<
    { id: string; name: string }[]
  >([]);

  const selectedPantryId = useAppStore(selectSelectedPantryId);
  const { selectedHomeId, getDefaultPantry } = useDefaultHome();

  const { data: homeData } = useGetHomeQuery({
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId,
  });

  // Load existing item for edit mode
  const { data: existingItemData, loading: itemLoading } =
    useGetPantryItemQuery({
      variables: { id: itemId ?? '' },
      skip: mode !== 'edit' || !itemId,
    });

  const [unitQuery] = useGetUnitBySymbolLazyQuery({
    fetchPolicy: 'cache-first',
  });

  const pantry = getDefaultPantry(homeData);
  const currentPantryId =
    selectedPantryId || pantry?.id || existingItemData?.pantryItem?.pantryId;

  // Fetch pantry details to get storage locations
  const { data: pantryData } = useGetPantryQuery({
    variables: { id: currentPantryId ?? '' },
    skip: !currentPantryId,
    fetchPolicy: 'cache-first',
  });

  const normalizedPantry = pantryData?.pantry
    ? normalizePantry(pantryData.pantry)
    : null;
  const storageLocations = normalizedPantry?.storageLocations || [];

  // Add mutation (add mode only)
  const [addItem] = useCreatePantryItemMutation({
    update: (cache: any, { data: mutationData }: any) => {
      if (!mutationData?.createPantryItem || !currentPantryId) return;

      try {
        const pantryCacheId = cache.identify({
          __typename: 'Pantry',
          id: currentPantryId,
        });

        if (!pantryCacheId) return;

        cache.modify({
          id: pantryCacheId,
          fields: {
            itemsConnection(
              existingConnection: any = {},
              { readField, toReference }: any,
            ) {
              const newItemRef = toReference(mutationData.createPantryItem);
              const existingEdges = existingConnection?.edges || [];

              const exists = existingEdges.some(
                (edge: any) =>
                  readField('id', edge?.node) ===
                  mutationData.createPantryItem.id,
              );

              if (exists) {
                return existingConnection;
              }

              const newEdge = {
                __typename: 'PantryItemEdge',
                node: newItemRef,
                cursor: '',
              };

              return {
                ...existingConnection,
                edges: [newEdge, ...existingEdges],
                totalCount: (existingConnection?.totalCount || 0) + 1,
              };
            },
          },
        });
      } catch (error) {
        console.warn('Cache update failed:', error);
      }
    },
  });

  // Update mutation (edit mode only)
  const [updateItem] = useUpdatePantryItemMutation();
  const [updateItemQuantity] = useUpdatePantryItemQuantityMutation();

  // Get initial values based on mode
  const getInitialValues = useCallback((): PantryItemFormData => {
    if (mode === 'edit' && existingItemData?.pantryItem) {
      const item = existingItemData.pantryItem;
      // Use packageWeight if set, otherwise fall back to item.netWeight from catalog
      const weight = item.packageWeight ?? item.item?.netWeight ?? undefined;
      // Tracking unit (for counting items) - from item.unit or item.unitName
      const trackingUnitSymbol = item.unit?.symbol || item.unitName || '';
      // Weight unit (for physical weight) - from item.packageWeightUnit or catalog displayUnit
      const weightUnitSymbol = item.packageWeightUnit?.symbol || item.item?.displayUnit?.symbol || '';
      return {
        quantityInput: item.currentQuantity?.toString() || '1',
        unit: trackingUnitSymbol, // Tracking unit
        itemWeight: weight,
        weightUnit: weightUnitSymbol, // Weight unit (separate from tracking)
        minQuantity: item.minQuantity?.toString() || '',
        restockQuantity: item.restockQuantity?.toString() || '',
        brand: item.brand?.name || '',
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
      itemWeight: undefined,
      weightUnit: '', // Weight unit
      minQuantity: '',
      restockQuantity: '',
      storageState: StorageState.Ambient,
      location: '',
      notes: '',
      category: '',
    };
  }, [mode, existingItemData]);

  const {
    control,
    handleSubmit,
    formState: { errors, dirtyFields },
    setValue,
    watch,
    reset,
  } = useForm<PantryItemFormData>({
    resolver:
      mode === 'add'
        ? (yupResolver(addItemSchema) as any)
        : (yupResolver(editItemSchema) as any),
    defaultValues: getInitialValues(),
    mode: 'onChange',
  });

  const watchedValues = watch();

  // Reset form when switching modes or loading existing data
  useEffect(() => {
    if (mode === 'edit' && existingItemData?.pantryItem) {
      reset(getInitialValues());
      // Initialize unit state from existing item
      const item = existingItemData.pantryItem;
      setSelectedUnitId(item.unit?.id || null);
      setSelectedUnitName(item.unit?.name || null);
    }
  }, [mode, existingItemData, reset, getInitialValues]);

  // Handlers for item selection (add mode only)
  const handleItemSelect = useCallback(
    (item: ItemSuggestion) => {
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
      if (item.defaultUnit?.symbol) {
        setValue('unit', item.defaultUnit.symbol);
      }
      if (item.defaultUnit?.id) {
        setSelectedUnitId(item.defaultUnit.id);
      }
      // Auto-populate weight from catalog
      if (item.netWeight != null) {
        setValue('itemWeight', item.netWeight);
      }
    },
    [setValue],
  );

  const handleCategorySelect = useCallback((categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
  }, []);

  const handleStorageLocationSelect = useCallback(
    (locationId: string | null, location: any) => {
      setSelectedLocationId(locationId);

      if (location?.temperature) {
        const tempLower = location.temperature.toLowerCase();
        if (tempLower === 'frozen') {
          setValue('storageState', StorageState.Frozen, { shouldDirty: true });
        } else if (tempLower === 'refrigerated') {
          setValue('storageState', StorageState.Refrigerated, { shouldDirty: true });
        } else if (tempLower === 'ambient') {
          setValue('storageState', StorageState.Ambient, { shouldDirty: true });
        }
      }
    },
    [setValue],
  );

  // Handler for adding a new storage location (user typed a custom name)
  const handleAddNewLocation = useCallback(
    (name: string) => {
      setValue('location', name, { shouldDirty: true });
      setSelectedLocationId(null); // Clear ID - will use name for server to find or create
    },
    [setValue],
  );

  const handleUnitSelected = useCallback(
    (unitId: string | null, unitName: string | null, unitType?: string | null) => {
      setSelectedUnitId(unitId);
      setSelectedUnitName(unitName);
      setSelectedUnitType(unitType ?? null);
    },
    [],
  );

  // Handler for weight unit selection (separate from tracking unit)
  const handleWeightUnitSelected = useCallback(
    (unitId: string | null, unitName: string | null, unitType?: string | null) => {
      setSelectedWeightUnitId(unitId);
      setSelectedWeightUnitName(unitName);
      setSelectedWeightUnitType(unitType ?? null);
    },
    [],
  );

  // Parse fractional quantity input
  const parseQuantityInput = (input: string): number | null => {
    try {
      const trimmed = input.trim();

      if (trimmed.includes('/')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length === 2) {
          // Mixed number like "1 1/4"
          const whole = parseInt(parts[0]);
          const [num, den] = parts[1].split('/').map(Number);
          return whole + num / den;
        } else {
          // Simple fraction like "3/4"
          const [num, den] = trimmed.split('/').map(Number);
          return num / den;
        }
      } else {
        // Regular number
        return parseFloat(trimmed);
      }
    } catch {
      return null;
    }
  };

  // Build update input with only dirty (changed) fields
  // Note: quantity and tracking unit changes are handled separately via updatePantryItemQuantity
  const buildDirtyInput = (
    data: PantryItemFormData,
    dirty: typeof dirtyFields,
    locationId: string | null,
    weightUnitId: string | null,
  ) => {
    const input: Record<string, any> = {};

    if (dirty.storageState) {
      input.storageState = data.storageState;
    }

    // UpdatePantryItemInput only accepts storageLocationId, not storageLocation name
    if (dirty.location && locationId) {
      input.storageLocationId = locationId;
    }

    if (dirty.expirationDate) {
      input.expiresAt = data.expirationDate?.toISOString() ?? null;
    }

    if (dirty.notes) {
      input.storageNotes = data.notes;
    }

    // Note: category editing removed - customCategory field no longer exists

    if (dirty.tags) {
      input.tags = data.tags || [];
    }

    // Weight changes - MUST send both packageWeight and packageWeightUnitId together per API docs
    if (dirty.itemWeight || dirty.weightUnit) {
      input.packageWeight = data.itemWeight ?? null;
      // Always include weight unit when weight is set
      if (data.itemWeight && weightUnitId) {
        input.packageWeightUnitId = weightUnitId;
      }
    }

    // Low stock settings
    if (dirty.minQuantity) {
      input.minQuantity = data.minQuantity ? parseFloat(data.minQuantity) : null;
    }
    if (dirty.restockQuantity) {
      input.restockQuantity = data.restockQuantity ? parseFloat(data.restockQuantity) : null;
    }

    return input;
  };

  const handleSave = async (data: PantryItemFormData) => {
    // Validate quantity input
    const quantityValue = parseQuantityInput(data.quantityInput || '');
    if (!quantityValue || quantityValue <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (!currentPantryId) {
      Alert.alert('Error', 'No pantry selected. Please select a pantry first.');
      return;
    }

    setSaving(true);
    try {
      // Resolve unit ID
      let unitId = selectedUnitId;
      if (!unitId && data.unit.trim()) {
        const unitData = await unitQuery({
          variables: { symbol: data.unit.trim() },
        });
        unitId = unitData.data?.unitBySymbol?.id || '';
      }

      if (mode === 'add') {
        // Add mode validation
        if (!data.itemName?.trim()) {
          Alert.alert('Error', 'Please enter an item name');
          setSaving(false);
          return;
        }

        // Determine storage location field: use ID if selected, name if typed
        const storageLocationInput = selectedLocationId
          ? { storageLocationId: selectedLocationId }
          : data.location.trim()
          ? { storageLocationName: data.location.trim() }
          : {};

        const baseInput = {
          pantryId: currentPantryId,
          unitId: unitId || '',
          initialQuantity: quantityValue,
          storageState: data.storageState as StorageState,
          expiresAt: data.expirationDate?.toISOString() || null,
          storageNotes: data.notes.trim() || null,
          minQuantity: data.minQuantity ? parseFloat(data.minQuantity) : undefined,
          restockQuantity: data.restockQuantity ? parseFloat(data.restockQuantity) : undefined,
          ...storageLocationInput,
        };

        let input: any;

        if (data.selectedItemId) {
          // Use selectedWeightUnitId for package weight (separate from tracking unit)
          const weightInput =
            data.itemWeight && selectedWeightUnitId
              ? { packageWeight: data.itemWeight, packageWeightUnitId: selectedWeightUnitId }
              : {};

          input = {
            ...baseInput,
            itemId: data.selectedItemId,
            ...weightInput,
          };
        } else {
          const categoryInput = selectedCategoryId
            ? { itemCategory: selectedCategoryId }
            : data.category.trim()
            ? { itemCategory: data.category.trim() }
            : {};

          // Use selectedWeightUnitId for item weight (separate from tracking unit)
          const weightInput =
            data.itemWeight && selectedWeightUnitId
              ? { itemNetWeight: data.itemWeight, itemDisplayUnitId: selectedWeightUnitId }
              : {};

          input = {
            ...baseInput,
            itemName: data.itemName!.trim(),
            itemDescription: data.notes.trim() || null,
            itemBrand: data.brand?.trim() || null,
            ...categoryInput,
            ...weightInput,
          };
        }

        const result = await addItem({ variables: { input } });

        if (result.data?.createPantryItem) {
          onSuccess?.();
        } else {
          Alert.alert('Error', 'Failed to add pantry item. Please try again.');
        }
      } else {
        // Edit mode - handle quantity/unit changes separately
        const quantityOrUnitChanged =
          dirtyFields.quantityInput || dirtyFields.unit;

        // If quantity or unit changed, use updatePantryItemQuantity mutation
        if (quantityOrUnitChanged) {
          const currentItem = existingItemData?.pantryItem;
          const newQuantity = parseFloat(data.quantityInput || quantityValue.toString());

          await updateItemQuantity({
            variables: {
              pantryItemId: itemId!,
              quantity: data.quantityInput || quantityValue.toString(),
              unitId: unitId || undefined,
              version: currentItem?.version ?? undefined,
            },
            // Optimistic response for instant UI update (no flicker)
            optimisticResponse: currentItem ? {
              __typename: 'Mutation',
              updatePantryItemQuantity: enhanceWithVersion(currentItem as any, {
                currentQuantity: newQuantity,
                unit: unitId ? {
                  ...currentItem.unit,
                  __typename: 'Unit',
                  id: unitId,
                  symbol: data.unit || currentItem.unit?.symbol,
                  name: data.unit || currentItem.unit?.name,
                  type: selectedUnitType || currentItem.unit?.type,
                } : currentItem.unit,
                unitId: unitId || currentItem.unitId,
                unitName: data.unit || currentItem.unitName,
              }),
            } : undefined,
          });
        }

        // Build input for other dirty fields (excluding quantity/tracking unit)
        const input = buildDirtyInput(data, dirtyFields, selectedLocationId, selectedWeightUnitId);

        // Update other fields if any changed
        if (Object.keys(input).length > 0) {
          const currentItemForUpdate = existingItemData?.pantryItem;

          // Build enhanced input with full nested objects for cache
          const optimisticInput: Record<string, any> = { ...input };

          // If weight unit changed, include full packageWeightUnit object
          if (input.packageWeightUnitId && currentItemForUpdate) {
            optimisticInput.packageWeightUnit = {
              ...currentItemForUpdate.packageWeightUnit,
              __typename: 'Unit',
              id: input.packageWeightUnitId,
              symbol: data.weightUnit || currentItemForUpdate.packageWeightUnit?.symbol,
              name: data.weightUnit || currentItemForUpdate.packageWeightUnit?.name,
              type: selectedWeightUnitType || currentItemForUpdate.packageWeightUnit?.type,
            };
          }

          await updateItem({
            variables: { id: itemId!, input },
            // Optimistic response for instant UI update (no flicker)
            optimisticResponse: currentItemForUpdate ? {
              __typename: 'Mutation',
              updatePantryItem: enhanceWithVersion(currentItemForUpdate as any, optimisticInput),
            } : undefined,
          });
        }

        // If nothing changed at all, just succeed
        if (!quantityOrUnitChanged && Object.keys(input).length === 0) {
          onSuccess?.();
          return;
        }

        onSuccess?.();
      }
    } catch (error) {
      console.error(
        `${mode === 'add' ? 'Add' : 'Update'} pantry item error:`,
        error,
      );
      Alert.alert(
        'Error',
        `Failed to ${
          mode === 'add' ? 'add' : 'update'
        } pantry item. Please try again.`,
      );
    } finally {
      setSaving(false);
    }
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

  // Tags section fields (edit mode only)
  const tagsFields: FieldDef<PantryItemFormData>[] = [
    {
      name: 'tags' as any,
      label: 'Tags',
      placeholder: 'Enter tags separated by commas',
      component: FormInput,
      renderValue: (value: string[] | string) =>
        Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : '',
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
    <View testID={formTestID} style={{ flex: 1, paddingTop: 12 }}>
      <KeyboardAvoidingView
        style={commonStyles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Header
          title={mode === 'add' ? 'Add Pantry Item' : 'Edit Pantry Item'}
          centerTitle
          leftActions={[
            {
              icon: 'close',
              onPress: () => navigation.goBack(),
              testID: 'pantry-item-form-close-button',
            },
          ]}
          rightActions={[
            {
              icon: 'check',
              onPress: handleSubmit(handleSave),
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
              />
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Item Information</Text>
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>
                    {item?.item?.name || item?.itemName || 'Unknown Item'}
                  </Text>
                </View>
                {item?.brand?.name && (
                  <View style={[styles.readOnlyField, { marginTop: 8 }]}>
                    <Text style={styles.readOnlyLabel}>Brand</Text>
                    <Text style={styles.readOnlyText}>{item.brand.name}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Quantity Section */}
            <QuantitySection
              control={control}
              errors={errors}
              mode={mode}
              onUnitSelected={handleUnitSelected}
              onWeightUnitSelected={handleWeightUnitSelected}
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
              weightUnitTestID={
                mode === 'add'
                  ? 'add-pantry-item-weight-unit-picker'
                  : 'edit-pantry-item-weight-unit-picker'
              }
              // Edit mode stock info (read-only display)
              initialQuantity={item?.initialQuantity}
              consumedQuantity={item?.consumedQuantity}
              unitSymbol={item?.unit?.symbol}
              packageWeight={item?.packageWeight ?? item?.item?.netWeight}
              weightUnitSymbol={item?.packageWeightUnit?.symbol || item?.item?.displayUnit?.symbol}
            />

            {/* Storage Details Section */}
            <StorageDetailsSection
              control={control}
              errors={errors}
              mode={mode}
              storageState={watchedValues.storageState}
              expirationDate={watchedValues.expirationDate}
              onStorageStateChange={state => setValue('storageState', state, { shouldDirty: true })}
              onDateChange={date => {
                setValue('expirationDate', date ?? undefined, { shouldDirty: true });
              }}
              onCategorySelected={handleCategorySelect}
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
  readOnlyField: {
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceVariant,
  },
  readOnlyLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  readOnlyText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textTertiary,
  },
  errorText: {
    fontSize: theme.fonts.size.lg,
    color: theme.colors.error,
  },
}));
