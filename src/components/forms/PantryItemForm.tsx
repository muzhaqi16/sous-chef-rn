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
  useGetPantryItemQuery,
  useGetHomeQuery,
  useGetPantryQuery,
  ItemSuggestion,
} from '#generated';
import {
  usePantryItemFormMutations,
  parseQuantityInput,
  emptyUnitSelection,
  type UnitSelection,
} from '#hooks/pantry';
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

  // Consolidated unit state using UnitSelection type
  const [trackingUnit, setTrackingUnit] = useState<UnitSelection>(emptyUnitSelection);
  const [weightUnit, setWeightUnit] = useState<UnitSelection>(emptyUnitSelection);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [suggestedBrands, setSuggestedBrands] = useState<{ id: string; name: string }[]>([]);

  const selectedPantryId = useAppStore(selectSelectedPantryId);
  const { selectedHomeId, getDefaultPantry } = useDefaultHome();

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

  // Mutation hook with proper Apollo patterns
  const { createPantryItem, updatePantryItem, resolveUnitId } =
    usePantryItemFormMutations({
      pantryId: currentPantryId,
      onSuccess,
      refetch: refetchItem,
    });

  // Get initial values based on mode
  const getInitialValues = useCallback((): PantryItemFormData => {
    if (mode === 'edit' && existingItemData?.pantryItem) {
      const item = existingItemData.pantryItem;
      // Use packageWeight if set, otherwise fall back to item.netWeight from catalog
      const weight = item.packageWeight ?? item.item?.netWeight ?? undefined;
      // Tracking unit (for counting items) - from item.unit or item.unitName
      const trackingUnitSymbol = item.unit?.symbol || item.unitName || '';
      // Weight unit (for physical weight) - from item.packageWeightUnit or catalog displayUnit
      const weightUnitSymbol =
        item.packageWeightUnit?.symbol || item.item?.displayUnit?.symbol || '';
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
      // Tracking unit state
      setTrackingUnit({
        id: item.unit?.id || null,
        name: item.unit?.name || null,
        symbol: item.unit?.symbol || null,
        type: item.unit?.type || null,
      });
      // Weight unit state (separate from tracking unit)
      const packageWeightUnit = item.packageWeightUnit;
      const displayUnit = item.item?.displayUnit;
      setWeightUnit({
        id: packageWeightUnit?.id || displayUnit?.id || null,
        name: packageWeightUnit?.name || displayUnit?.name || null,
        symbol: packageWeightUnit?.symbol || displayUnit?.symbol || null,
        type: packageWeightUnit?.type || null,
      });
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
      if (item.defaultUnit) {
        setTrackingUnit({
          id: item.defaultUnit.id || null,
          name: item.defaultUnit.name || null,
          symbol: item.defaultUnit.symbol || null,
          type: null, // ItemSuggestion doesn't include unit type
        });
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

  // Handler for weight unit selection (separate from tracking unit)
  const handleWeightUnitSelected = useCallback(
    (
      unitId: string | null,
      unitName: string | null,
      unitType?: string | null,
    ) => {
      setWeightUnit(prev => ({
        ...prev,
        id: unitId,
        name: unitName,
        type: unitType ?? null,
      }));
    },
    [],
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
          selectedWeightUnitId: weightUnit.id,
        });
      } else {
        const currentItem = existingItemData?.pantryItem;
        if (!currentItem || !itemId) {
          Alert.alert('Error', 'Item not found');
          return;
        }

        await updatePantryItem({
          itemId,
          input: data,
          currentItem,
          dirtyFields: dirtyFields as Record<string, boolean>,
          quantityValue,
          unitId,
          trackingUnit,
          weightUnit,
          selectedLocationId,
        });
      }
    } catch (error) {
      console.error(
        `${mode === 'add' ? 'Add' : 'Update'} pantry item error:`,
        error,
      );
      Alert.alert(
        'Error',
        `Failed to ${mode === 'add' ? 'add' : 'update'} pantry item. Please try again.`,
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
              weightUnitSymbol={
                item?.packageWeightUnit?.symbol ||
                item?.item?.displayUnit?.symbol
              }
            />

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
