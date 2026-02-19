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
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object, string } from 'yup';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useNavigation } from '@react-navigation/native';

import { commonStyles } from '#/styles/commonStyles';
import { useAppStore, selectSelectedPantryId, selectSelectedHomeId } from '#store/useAppStore';
import { normalizeHome } from '#/utils/connectionUtils';
import {
  StorageState,
  useGetPantryItemQuery,
  useGetHomeQuery,
  useGetPantryQuery,
  ItemSuggestion,
} from '#generated';
import { useCreatePantryItem } from '#hooks/pantry/mutations/useCreatePantryItem';
import { useUpdatePantryItem } from '#hooks/pantry/mutations/useUpdatePantryItem';
import { useUpdatePantryItemQuantity } from '#hooks/pantry/mutations/useUpdatePantryItemQuantity';
import { useResolveUnit } from '#hooks/pantry/mutations/useResolveUnit';
import { emptyUnitSelection, type UnitSelection } from '#hooks/pantry/mutations/types';
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
  const [_saving, setSaving] = useState(false);

  // Consolidated unit state using UnitSelection type
  const [trackingUnit, setTrackingUnit] =
    useState<UnitSelection>(emptyUnitSelection);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [suggestedBrands, setSuggestedBrands] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [_selectedNetWeightUnitId, setSelectedNetWeightUnitId] = useState<string | null>(null);
  const [netWeightUnitDisplay, setNetWeightUnitDisplay] = useState('');

  const selectedPantryId = useAppStore(selectSelectedPantryId);
  // Get selectedHomeId from Zustand (no GraphQL query triggered)
  const selectedHomeId = useAppStore(selectSelectedHomeId);

  // Helper to get default pantry (inline to avoid useDefaultHome dependency)
  const getDefaultPantry = useCallback((data: any) => {
    const normalized = normalizeHome(data?.home ?? data);
    if (!normalized?.pantries?.length) return null;
    return normalized.pantries.find((p: any) => p.isDefault) || normalized.pantries[0] || null;
  }, []);

  const { data: homeData } = useGetHomeQuery({
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId,
  });

  // Load existing item for edit mode
  const {
    data: existingItemData,
    loading: itemLoading,
    refetch: refetchItem,
  } = useGetPantryItemQuery({
    variables: { id: itemId ?? '' },
    skip: mode !== 'edit' || !itemId,
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
  const getInitialValues = useCallback((): PantryItemFormData => {
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
      netWeightUnitId: '',
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
      // Tracking unit state
      if (item.unit) {
        setTrackingUnit({
          id: item.unit.id,
          name: item.unit.name,
          symbol: item.unit.symbol,
          type: item.unit.type ?? null,
        });
      }
      // Initialize net weight unit from existing item
      if (item.netWeightUnit?.id) {
        setSelectedNetWeightUnitId(item.netWeightUnit.id);
        setNetWeightUnitDisplay(
          item.netWeightUnit?.symbol || item.netWeightUnit?.name || '',
        );
      }
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
    },
    [setValue, setTrackingUnit],
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
          setValue('storageState', StorageState.Refrigerated, {
            shouldDirty: true,
          });
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
    (
      unitId: string | null,
      unitName: string | null,
      unitType?: string | null,
    ) => {
      setTrackingUnit(prev => ({
        ...prev,
        id: unitId,
        name: unitName,
        type: unitType ?? null,
      }));
    },
    [],
  );

  const handleNetWeightUnitSelected = useCallback(
    (unitId: string | null, unitName: string | null) => {
      setSelectedNetWeightUnitId(unitId);
      if (unitName) setNetWeightUnitDisplay(unitName);
      if (unitId) {
        setValue('netWeightUnitId', unitId, { shouldDirty: true });
      }
    },
    [setValue],
  );

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
      // Resolve unit ID from symbol if needed
      const unitId = await resolveUnitId(trackingUnit.id, data.unit);

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
          Alert.alert('Error', 'Item not found');
          return;
        }

        const dirtyFieldsRecord = { ...dirtyFields } as Record<string, boolean>;

        // Strip weight fields when locked — weight changes must go through correctPantryItemWeight
        if (isWeightLocked) {
          delete dirtyFieldsRecord.netWeight;
          delete dirtyFieldsRecord.netWeightUnitId;
        }

        const quantityOrUnitChanged =
          dirtyFieldsRecord.quantityInput || dirtyFieldsRecord.unit;

        // Handle quantity/unit changes with dedicated mutation
        if (quantityOrUnitChanged) {
          updateQuantity({
            itemId,
            quantityInput: data.quantityInput || quantityValue.toString(),
            quantityValue,
            unitId,
            unitSymbol: data.unit,
            trackingUnit,
            currentItem,
          });
        }

        // Handle non-quantity field updates
        updatePantryItemFields({
          itemId,
          input: data,
          currentItem,
          dirtyFields: dirtyFieldsRecord,
          selectedLocationId,
          selectedBrandId,
        });
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
              icon: 'check',
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
              />
            ) : (
              <ItemInformationSection
                control={control}
                errors={errors}
                mode="edit"
                suggestedBrands={suggestedBrands}
                onBrandSelected={setSelectedBrandId}
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
                  <UnitAutocompleteField
                    variant="modal"
                    label="Unit"
                    value={netWeightUnitDisplay}
                    onChangeText={setNetWeightUnitDisplay}
                    onUnitSelected={handleNetWeightUnitSelected}
                    placeholder="oz, g, ml"
                  />
                </FieldRow>
              </View>
              {isWeightLocked && (
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
              storageState={watchedValues.storageState}
              expirationDate={watchedValues.expirationDate}
              onStorageStateChange={state =>
                setValue('storageState', state, { shouldDirty: true })
              }
              onDateChange={date => {
                setValue('expirationDate', date ?? undefined, {
                  shouldDirty: true,
                });
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
  lockedSection: {
    opacity: theme.opacity.disabled,
  },
  lockedHint: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
}));
