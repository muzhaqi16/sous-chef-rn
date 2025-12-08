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
  GetPantryItemDocument,
  useGetHomeQuery,
  useGetPantryQuery,
  useGetUnitBySymbolLazyQuery,
  ItemSuggestion,
} from '#generated';
import { normalizePantry } from '#/utils/connectionUtils';
import { getEffectiveUnitSymbol } from '#/utils/pantryItemUtils';
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
  itemWeight?: number;
  unit: string;

  // Edit mode specific
  tags?: string[];

  // Storage fields (both modes)
  minimumQuantity?: string;
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
  itemWeight: yup
    .number()
    .positive('Item weight must be positive')
    .nullable()
    .transform((value, originalValue) => (originalValue === '' ? null : value)),
  unit: yup.string(),
  minimumQuantity: yup.string(),
  storageState: yup.string().oneOf(Object.values(StorageState)),
  location: yup.string(),
  notes: yup.string(),
  category: yup.string(),
  brand: yup.string(),
});

// Schema for edit mode
const editItemSchema = yup.object({
  quantityInput: yup.string().required('Quantity is required'),
  itemWeight: yup
    .number()
    .positive('Item weight must be positive')
    .nullable()
    .transform((value, originalValue) => (originalValue === '' ? null : value)),
  unit: yup.string(),
  minimumQuantity: yup.string(),
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [_saving, setSaving] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [_selectedUnitName, setSelectedUnitName] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );

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
      // Use centralized utility for correct unit priority
      const weightUnitSymbol = getEffectiveUnitSymbol(item) || '';
      return {
        quantityInput: item.currentQuantity?.toString() || '1',
        itemWeight: weight,
        unit: weightUnitSymbol,
        // Note: minimumQuantity is not stored on PantryItem in the API
        // The lowStockAlert boolean is used instead
        minimumQuantity: '',
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
      itemWeight: undefined,
      unit: '',
      minimumQuantity: '',
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
      if (item.brand?.name) {
        setValue('brand', item.brand.name);
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
          setValue('storageState', StorageState.Frozen);
        } else if (tempLower === 'refrigerated') {
          setValue('storageState', StorageState.Refrigerated);
        } else if (tempLower === 'ambient') {
          setValue('storageState', StorageState.Ambient);
        }
      }
    },
    [setValue],
  );

  // Handler for adding a new storage location (user typed a custom name)
  const handleAddNewLocation = useCallback(
    (name: string) => {
      setValue('location', name);
      setSelectedLocationId(null); // Clear ID - will use name for server to find or create
    },
    [setValue],
  );

  const handleUnitSelected = useCallback(
    (unitId: string | null, unitName: string | null) => {
      setSelectedUnitId(unitId);
      setSelectedUnitName(unitName);
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
  // Note: quantity and unit changes are handled separately via updatePantryItemQuantity
  const buildDirtyInput = (
    data: PantryItemFormData,
    dirty: typeof dirtyFields,
    locationId: string | null,
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
      input.expiresAt = data.expirationDate?.toISOString();
    }

    if (dirty.notes) {
      input.storageNotes = data.notes;
    }

    // Note: category editing removed - customCategory field no longer exists

    if (dirty.tags) {
      input.tags = data.tags || [];
    }

    if (dirty.itemWeight) {
      input.packageWeight = data.itemWeight;
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
          ...storageLocationInput,
        };

        let input: any;

        if (data.selectedItemId) {
          const weightInput =
            data.itemWeight && unitId
              ? { packageWeight: data.itemWeight, packageWeightUnitId: unitId }
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

          const weightInput =
            data.itemWeight && unitId
              ? { itemNetWeight: data.itemWeight, itemDisplayUnitId: unitId }
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
          await updateItemQuantity({
            variables: {
              pantryItemId: itemId!,
              quantity: data.quantityInput || quantityValue.toString(),
              unitId: unitId || undefined,
              version: existingItemData?.pantryItem?.version ?? undefined,
            },
            refetchQueries: [
              { query: GetPantryItemDocument, variables: { id: itemId } },
            ],
          });
        }

        // Build input for other dirty fields (excluding quantity/unit)
        const input = buildDirtyInput(data, dirtyFields, selectedLocationId);

        // Update other fields if any changed
        if (Object.keys(input).length > 0) {
          await updateItem({
            variables: { id: itemId!, input },
            refetchQueries: [
              { query: GetPantryItemDocument, variables: { id: itemId } },
            ],
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
              </View>
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
              initialQuantity={item?.initialQuantity}
              consumedQuantity={item?.consumedQuantity}
              unitSymbol={item?.unit?.symbol}
              packageWeight={item?.packageWeight ?? item?.item?.netWeight}
              weightUnitSymbol={item ? getEffectiveUnitSymbol(item) : undefined}
            />

            {/* Storage Details Section */}
            <StorageDetailsSection
              control={control}
              errors={errors}
              mode={mode}
              storageState={watchedValues.storageState}
              expirationDate={watchedValues.expirationDate}
              showDatePicker={showDatePicker}
              onStorageStateChange={state => setValue('storageState', state)}
              onDatePickerToggle={() => setShowDatePicker(!showDatePicker)}
              onDateChange={date => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setValue('expirationDate', date);
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
  readOnlyText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textTertiary,
  },
  errorText: {
    fontSize: theme.fonts.size.lg,
    color: theme.colors.error,
  },
}));
