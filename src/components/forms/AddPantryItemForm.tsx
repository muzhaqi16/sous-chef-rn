import React, { useState, useCallback } from 'react';
import { View, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { ApolloCache } from '@apollo/client';

import { commonStyles } from '#/styles/commonStyles';
import { useDefaultHome } from '#hooks';
import {
  StorageState,
  useAddItemToPantryMutation,
  useGetHomeQuery,
  useGetUnitBySymbolLazyQuery,
  ItemSuggestion,
  GetPantryItemsDocument,
  PantryItemFragment,
} from '#generated';

import { PantryItemFormHeader } from './PantryItemFormHeader';
import { ItemInformationSection } from './ItemInformationSection';
import { QuantitySection } from './QuantitySection';
import { StorageDetailsSection } from './StorageDetailsSection';

interface AddPantryItemFormData {
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
}

const addItemSchema = yup.object({
  itemName: yup.string().required('Item name is required'),
  quantity: yup.number().min(1, 'Quantity must be at least 1').required(),
  unit: yup.string(),
  minimumQuantity: yup.string(),
  storageState: yup.string().oneOf(Object.values(StorageState)),
  location: yup.string(),
  notes: yup.string(),
  category: yup.string(),
  brand: yup.string(),
});

interface AddPantryItemFormProps {
  onSuccess?: () => void;
}

export const AddPantryItemForm: React.FC<AddPantryItemFormProps> = ({
  onSuccess,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const {
    selectedHomeId,
    getDefaultPantry,
  } = useDefaultHome();

  const { data: homeData } = useGetHomeQuery({
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId,
  });

  const [unitQuery] = useGetUnitBySymbolLazyQuery({
    fetchPolicy: 'network-only',
  });

  const pantry = getDefaultPantry(homeData);

  const [addItem] = useAddItemToPantryMutation({
    update: (cache: ApolloCache, { data: mutationData }: any) => {
      if (!mutationData?.addItemToPantry || !pantry?.id) return;
      const newItem = mutationData.addItemToPantry;
      try {
        const existingData = cache.readQuery<{
          pantryItems: PantryItemFragment[];
        }>({
          query: GetPantryItemsDocument,
          variables: { pantryId: pantry.id },
        });
        if (existingData?.pantryItems) {
          cache.writeQuery({
            query: GetPantryItemsDocument,
            variables: { pantryId: pantry.id },
            data: {
              pantryItems: [newItem, ...existingData.pantryItems],
            },
          });
        }
      } catch (error) {
        console.warn('Cache update failed:', error);
      }
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AddPantryItemFormData>({
    resolver: yupResolver(addItemSchema) as any,
    defaultValues: {
      itemName: '',
      brand: '',
      quantity: 1,
      unit: '',
      minimumQuantity: '',
      storageState: StorageState.Ambient,
      location: '',
      notes: '',
      category: '',
    },
    mode: 'onChange',
  });

  const watchedValues = watch();

  const handleItemSelect = useCallback(
    (item: ItemSuggestion) => {
      setValue('itemName', item.name);
      setValue('selectedItemId', item.id);
      if (item.brand?.name) {
        setValue('brand', item.brand.name);
      }
      if (item.category?.name) {
        setValue('category', item.category.name);
        // Clear category selection since this comes from item selection
        setSelectedCategoryId(null);
      }
      if (item.defaultUnit?.symbol) {
        setValue('unit', item.defaultUnit.symbol);
      }
    },
    [setValue],
  );

  const handleCategorySelect = useCallback(
    (categoryId: string | null) => {
      setSelectedCategoryId(categoryId);
    },
    [],
  );

  const handleIncrementQuantity = useCallback(() => {
    const current = watchedValues.quantity || 0;
    setValue('quantity', current + 1);
  }, [setValue, watchedValues.quantity]);

  const handleDecrementQuantity = useCallback(() => {
    const current = watchedValues.quantity || 1;
    setValue('quantity', Math.max(1, current - 1));
  }, [setValue, watchedValues.quantity]);

  const handleSave = async (data: AddPantryItemFormData) => {
    if (!data.itemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    if (data.quantity <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (!pantry?.id) {
      Alert.alert('Error', 'No pantry selected. Please select a pantry first.');
      return;
    }

    setSaving(true);
    try {
      // Use selectedUnitId if available (from autocomplete), otherwise query by symbol
      let unitId = selectedUnitId;
      if (!unitId && data.unit.trim()) {
        const unitData = await unitQuery({
          variables: { symbol: data.unit.trim() },
        });
        unitId = unitData.data?.unitBySymbol?.id || '';
      }

      const baseInput = {
        pantryId: pantry.id, // Already validated above, so we know it exists
        unitId: unitId || '',
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
        // Use selectedCategoryId if available, otherwise use category name
        const categoryInput = selectedCategoryId
          ? { customCategory: selectedCategoryId } // If we have a selected category ID, use it
          : data.category.trim()
            ? { itemCategory: data.category.trim() } // Otherwise use the typed category name
            : {};

        input = {
          ...baseInput,
          itemName: data.itemName.trim(),
          itemDescription: data.notes.trim() || null,
          itemBrand: data.brand.trim() || null,
          ...categoryInput,
        };
      }

      console.log('AddPantryItemForm: Submitting with pantryId:', pantry.id, 'input:', input);

      await addItem({ variables: { input } });
      onSuccess?.();
    } catch (error) {
      Alert.alert('Error', 'Failed to add pantry item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={commonStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <PantryItemFormHeader
        title="Add Pantry Item"
        onSave={handleSubmit(handleSave)}
        saving={saving}
      />

      <ScrollView
        style={commonStyles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={commonStyles.padding}>
          <ItemInformationSection
            control={control}
            errors={errors}
            mode="add"
            onSelectItem={handleItemSelect}
          />

          <QuantitySection
            control={control}
            errors={errors}
            mode="add"
            quantity={watchedValues.quantity}
            unit={watchedValues.unit}
            onIncrementQuantity={handleIncrementQuantity}
            onDecrementQuantity={handleDecrementQuantity}
            onUnitSelected={setSelectedUnitId}
            onUnitChange={(unit) => {
              setValue('unit', unit);
              // Clear selected unit ID when user types manually
              setSelectedUnitId(null);
            }}
          />

          <StorageDetailsSection
            control={control}
            errors={errors}
            mode="add"
            storageState={watchedValues.storageState}
            expirationDate={watchedValues.expirationDate}
            showDatePicker={showDatePicker}
            onStorageStateChange={(state) => setValue('storageState', state)}
            onDatePickerToggle={() => setShowDatePicker(!showDatePicker)}
            onDateChange={(date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (date) setValue('expirationDate', date);
            }}
            onCategorySelected={handleCategorySelect}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};