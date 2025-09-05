import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {useNavigation} from '@react-navigation/native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import * as yup from 'yup';

import {commonStyles} from '#/styles/commonStyles';
import {useDefaultHome} from '#hooks';
import {
  StorageState,
  useAddItemToPantryMutation,
  useUpdatePantryItemMutation,
  useGetPantryItemQuery,
  useGetHomeQuery,
  useGetUnitBySymbolLazyQuery,
  ItemSuggestion,
  GetPantryItemsDocument,
  PantryItemFragment,
} from '#generated';

import {EnhancedAutocompleteInput} from '#components/molecules/EnhancedAutocompleteInput';
import {UnitsAutocompleteInput} from '#components/molecules/UnitsAutocompleteInput';
import {BrandAutocompleteInput} from '#components/molecules/BrandAutocompleteInput';
import {Counter} from '#components/molecules/Counter';
import {
  DynamicFormFields,
  FieldDef,
} from '#components/molecules/DynamicFormFields';
import {FormInput} from '#components/molecules/FormInput';
import {FormTextArea} from '#components/molecules/FormTextArea';
import {FormCheckbox} from '#components/molecules/FormCheckbox';

const STORAGE_STATES = Object.values(StorageState);

interface PantryItemFormData {
  itemName: string;
  selectedItemId?: string;
  brand: string;
  quantity: number;
  unit: string;
  minimumQuantity: string;
  storageState: StorageState;
  location: string;
  expirationDate?: Date;
  notes: string;
  category: string;
  // Edit-specific fields
  reservedQuantity?: string;
  tags?: string[];
  isAutoReorder?: boolean;
  autoReorderPoint?: string;
}

const pantryItemSchema = yup.object({
  itemName: yup.string().required('Item name is required'),
  quantity: yup.number().min(1, 'Quantity must be at least 1').required(),
  unit: yup.string(),
  minimumQuantity: yup.string(),
  storageState: yup.string().oneOf(Object.values(StorageState)),
  location: yup.string(),
  notes: yup.string(),
  category: yup.string(),
  brand: yup.string(),
  reservedQuantity: yup.string(),
  autoReorderPoint: yup.string(),
});

interface PantryItemFormProps {
  mode: 'add' | 'edit';
  itemId?: string;
  onSuccess?: () => void;
}

export const PantryItemForm: React.FC<PantryItemFormProps> = ({
  mode,
  itemId,
  onSuccess,
}) => {
  const navigation = useNavigation();
  const {theme} = useUnistyles();

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const {
    selectedHomeId,
    loading: homesLoading,
    getDefaultPantry,
  } = useDefaultHome();

  const {data: homeData} = useGetHomeQuery({
    variables: {homeId: selectedHomeId ?? ''},
    skip: !selectedHomeId,
  });

  // Edit mode: fetch existing item data
  const {data: existingItemData, loading: itemLoading} = useGetPantryItemQuery({
    variables: {id: itemId ?? ''},
    skip: mode !== 'edit' || !itemId,
  });

  const [unitQuery] = useGetUnitBySymbolLazyQuery({
    fetchPolicy: 'network-only',
  });

  const pantry = getDefaultPantry(homeData);

  // Mutations
  const [addItem] = useAddItemToPantryMutation({
    update: (cache, {data: mutationData}) => {
      if (!mutationData?.addItemToPantry || !pantry?.id) return;
      const newItem = mutationData.addItemToPantry;
      try {
        const existingData = cache.readQuery<{
          pantryItems: PantryItemFragment[];
        }>({
          query: GetPantryItemsDocument,
          variables: {pantryId: pantry.id},
        });
        if (existingData?.pantryItems) {
          cache.writeQuery({
            query: GetPantryItemsDocument,
            variables: {pantryId: pantry.id},
            data: {
              pantryItems: [...existingData.pantryItems, newItem],
            },
          });
        }
      } catch (error) {
        console.warn('Cache update failed:', error);
      }
    },
  });

  const [updateItem] = useUpdatePantryItemMutation();

  // Get initial form values
  const getInitialValues = (): PantryItemFormData => {
    if (mode === 'edit' && existingItemData?.pantryItem) {
      const item = existingItemData.pantryItem;
      return {
        itemName: item.item?.name || '',
        selectedItemId: item.item?.id,
        brand: item.item?.brands?.[0]?.brand?.name || '',
        quantity: item.currentQuantity || 1,
        unit: item.unit?.symbol || '',
        minimumQuantity: '',
        storageState: item.storageState || StorageState.Ambient,
        location: item.storageLocation || '',
        expirationDate: item.expiresAt ? new Date(item.expiresAt) : undefined,
        notes: item.storageNotes || '',
        category: item.customCategory || '',
        reservedQuantity: item.reservedQuantity?.toString() || '',
        tags: item.tags || [],
        isAutoReorder: item.isAutoReorder || false,
        autoReorderPoint: item.autoReorderPoint?.toString() || '',
      };
    }

    return {
      itemName: '',
      brand: '',
      quantity: 1,
      unit: '',
      minimumQuantity: '',
      storageState: StorageState.Ambient,
      location: '',
      notes: '',
      category: '',
    };
  };

  const {
    control,
    handleSubmit,
    formState: {errors},
    setValue,
    watch,
    reset,
  } = useForm<PantryItemFormData>({
    resolver: yupResolver(pantryItemSchema) as any,
    defaultValues: getInitialValues(),
    mode: 'onChange',
  });

  const watchedValues = watch();

  // Reset form when existing item data loads
  useEffect(() => {
    if (mode === 'edit' && existingItemData?.pantryItem) {
      reset(getInitialValues());
    }
  }, [existingItemData, mode, reset]);

  // Handle item selection from autocomplete (Add mode only)
  const handleItemSelect = useCallback(
    (item: ItemSuggestion) => {
      setValue('itemName', item.name);
      setValue('selectedItemId', item.id);
      if (item.brand?.name) {
        setValue('brand', item.brand.name);
      }
      if (item.category?.name) {
        setValue('category', item.category.name);
      }
      if (item.defaultUnit?.symbol) {
        setValue('unit', item.defaultUnit.symbol);
      }
    },
    [setValue],
  );

  // Handle manual text change (clear selectedItemId for custom items)
  const handleItemNameChange = useCallback(
    (text: string) => {
      setValue('itemName', text);
      setValue('selectedItemId', undefined);
    },
    [setValue],
  );

  // Counter handlers
  const handleIncrementQuantity = useCallback(() => {
    const current = watchedValues.quantity || 0;
    setValue('quantity', current + 1);
  }, [setValue, watchedValues.quantity]);

  const handleDecrementQuantity = useCallback(() => {
    const current = watchedValues.quantity || 1;
    setValue('quantity', Math.max(1, current - 1));
  }, [setValue, watchedValues.quantity]);

  // Form field definitions based on mode
  const getFormFields = (): Array<{
    title: string;
    fields: FieldDef<PantryItemFormData>[];
  }> => {
    const commonFields = [
      {
        title: 'Storage Details',
        fields: [
          {
            name: 'storageState' as const,
            label: 'Storage Type',
            component: () => (
              <View style={styles.segmentedControl}>
                {STORAGE_STATES.map(state => (
                  <TouchableOpacity
                    key={state}
                    style={[
                      styles.segment,
                      watchedValues.storageState === state &&
                        styles.segmentActive,
                    ]}
                    onPress={() => setValue('storageState', state)}>
                    <Text
                      style={[
                        styles.segmentText,
                        watchedValues.storageState === state &&
                          styles.segmentTextActive,
                      ]}
                      numberOfLines={1}>
                      {state}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ),
          },
          {
            name: 'location' as const,
            label: 'Location',
            placeholder: 'e.g., Top shelf, Drawer 2',
            component: FormInput,
          },
          {
            name: 'expirationDate' as const,
            label: 'Expiration Date',
            component: () => (
              <TouchableOpacity
                style={[commonStyles.input, commonStyles.row, styles.dateInput]}
                onPress={() => setShowDatePicker(true)}>
                <Icon
                  name="event"
                  size={20}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.dateText}>
                  {watchedValues.expirationDate
                    ? watchedValues.expirationDate.toLocaleDateString()
                    : 'Select date'}
                </Text>
              </TouchableOpacity>
            ),
          },
          {
            name: 'category' as const,
            label: 'Category',
            placeholder: 'e.g., Grains, Dairy',
            component: FormInput,
          },
          {
            name: 'notes' as const,
            label: mode === 'edit' ? 'Storage Notes' : 'Notes',
            placeholder: 'Any additional notes...',
            component: FormTextArea,
            props: {numberOfLines: 3},
          },
        ],
      },
    ];

    if (mode === 'add') {
      return [
        {
          title: 'Item Information',
          fields: [
            {
              name: 'itemName' as const,
              label: 'Item Name',
              placeholder: 'e.g., Rice, Pasta',
              component: () => (
                <EnhancedAutocompleteInput
                  label="Item Name"
                  value={watchedValues.itemName}
                  onChangeText={handleItemNameChange}
                  onSelectItem={handleItemSelect}
                  placeholder="e.g., Rice, Pasta"
                  required
                  autoFocus
                />
              ),
            },
            {
              name: 'brand' as const,
              label: 'Brand',
              placeholder: "e.g., Kellogg's",
              component: () => (
                <BrandAutocompleteInput
                  label="Brand"
                  value={watchedValues.brand}
                  onChangeText={text => setValue('brand', text)}
                  placeholder="e.g., Kellogg's"
                />
              ),
            },
          ],
        },
        {
          title: 'Quantity & Unit',
          fields: [
            {
              name: 'quantity' as const,
              label: 'Quantity',
              component: () => (
                <View style={[commonStyles.row, commonStyles.gap]}>
                  <View style={[commonStyles.inputGroup, commonStyles.flex1]}>
                    <Text style={commonStyles.label}>Quantity *</Text>
                    <View style={styles.quantityContainer}>
                      <Counter
                        count={watchedValues.quantity}
                        onIncrement={handleIncrementQuantity}
                        onDecrement={handleDecrementQuantity}
                      />
                    </View>
                  </View>
                  <View style={[commonStyles.inputGroup, commonStyles.flex1]}>
                    <UnitsAutocompleteInput
                      label="Unit"
                      value={watchedValues.unit}
                      onChangeText={text => setValue('unit', text)}
                      placeholder="kg, lbs, pcs"
                      onUnitSelected={setSelectedUnitId}
                    />
                  </View>
                </View>
              ),
            },
            {
              name: 'minimumQuantity' as const,
              label: 'Minimum Quantity',
              placeholder: 'Alert when below this quantity',
              component: FormInput,
              props: {keyboardType: 'numeric'},
            },
          ],
        },
        ...commonFields,
      ];
    } else {
      // Edit mode fields
      return [
        {
          title: 'Item Information',
          fields: [
            {
              name: 'itemName' as const,
              label: 'Item Name',
              component: () => (
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>
                    {watchedValues.itemName}
                  </Text>
                </View>
              ),
            },
          ],
        },
        {
          title: 'Quantity & Stock',
          fields: [
            {
              name: 'quantity' as const,
              label: 'Current Quantity',
              placeholder: '1',
              component: FormInput,
              props: {keyboardType: 'numeric'},
            },
            {
              name: 'unit' as const,
              label: 'Unit',
              component: () => (
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>{watchedValues.unit}</Text>
                </View>
              ),
            },
            {
              name: 'reservedQuantity' as const,
              label: 'Minimum Stock Level',
              placeholder: 'Alert when below this quantity',
              component: FormInput,
              props: {keyboardType: 'numeric'},
            },
            {
              name: 'isAutoReorder' as const,
              label: 'Auto Reorder',
              component: FormCheckbox,
              props: {componentType: 'checkbox'},
            },
            ...(watchedValues.isAutoReorder
              ? [
                  {
                    name: 'autoReorderPoint' as const,
                    label: 'Reorder Point',
                    placeholder: 'Reorder when quantity reaches...',
                    component: FormInput,
                    props: {keyboardType: 'numeric'},
                  },
                ]
              : []),
          ],
        },
        ...commonFields,
        {
          title: 'Tags',
          fields: [
            {
              name: 'tags' as const,
              label: 'Tags',
              placeholder: 'Enter tags separated by commas',
              component: FormInput,
              renderValue: (value: string[]) =>
                Array.isArray(value) ? value.join(', ') : '',
              transformValue: (value: string) => {
                return value
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean);
              },
              transformOnBlur: true,
            },
          ],
        },
      ];
    }
  };

  const handleSave = async (data: PantryItemFormData) => {
    if (mode === 'add' && !data.itemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    if (data.quantity <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'add') {
        const unitData = await unitQuery({
          variables: {symbol: data.unit.trim()},
        });
        const unitId = unitData.data?.unitBySymbol?.id || '';

        const baseInput = {
          pantryId: pantry?.id || '',
          unitId: unitId,
          initialQuantity: data.quantity,
          storageState: data.storageState as StorageState,
          expiresAt: data.expirationDate?.toISOString() || null,
          storageNotes: data.notes.trim() || null,
          storageLocation: data.location.trim() || null,
        };

        let input: any;

        if (data.selectedItemId) {
          input = {
            ...baseInput,
            itemId: data.selectedItemId,
          };
        } else {
          input = {
            ...baseInput,
            itemName: data.itemName.trim(),
            itemDescription: data.notes.trim() || null,
            itemBrand: data.brand.trim() || null,
            itemCategory: data.category.trim() || null,
          };
        }

        await addItem({variables: {input}});
      } else {
        // Edit mode
        await updateItem({
          variables: {
            id: itemId!,
            input: {
              currentQuantity: data.quantity,
              reservedQuantity: parseFloat(data.reservedQuantity || '0') || 0,
              storageState: data.storageState,
              storageLocation: data.location,
              expiresAt: data.expirationDate?.toISOString(),
              storageNotes: data.notes,
              customCategory: data.category,
              tags: data.tags || [],
              isAutoReorder: data.isAutoReorder || false,
              autoReorderPoint:
                parseFloat(data.autoReorderPoint || '') || undefined,
            },
          },
        });
      }

      if (onSuccess) {
        onSuccess();
      } else {
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', `Failed to ${mode} pantry item`);
    } finally {
      setSaving(false);
    }
  };

  if (mode === 'edit' && itemLoading) {
    return (
      <View style={[commonStyles.container, commonStyles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const formSections = getFormFields();

  return (
    <View style={commonStyles.container}>
      {/* Header */}
      <View style={commonStyles.header}>
        <TouchableOpacity
          style={commonStyles.iconButton}
          onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={commonStyles.headerTitle}>
          {mode === 'add' ? 'Add Pantry Item' : 'Edit Pantry Item'}
        </Text>
        <TouchableOpacity
          style={commonStyles.iconButton}
          onPress={handleSubmit(handleSave)}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={commonStyles.scrollContent}>
        <View style={commonStyles.padding}>
          {formSections.map((section, sectionIndex) => (
            <View key={sectionIndex} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <DynamicFormFields
                fields={section.fields}
                control={control}
                errors={errors}
              />
            </View>
          ))}

          {showDatePicker && (
            <DateTimePicker
              value={watchedValues.expirationDate || new Date()}
              mode="date"
              onChange={(event, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setValue('expirationDate', date);
              }}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  saveButton: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
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
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  segmentActive: {
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  segmentTextActive: {
    color: theme.colors.white,
  },
  dateInput: {
    justifyContent: 'flex-start',
  },
  dateText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.md,
  },
  quantityContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
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
}));
