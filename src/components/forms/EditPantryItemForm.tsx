import React, {useState, useEffect, useCallback} from 'react';
import {View, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Text} from 'react-native';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

import {commonStyles} from '#/styles/commonStyles';
import {
  StorageState,
  useUpdatePantryItemMutation,
  useGetPantryItemQuery,
} from '#generated';
import {DynamicFormFields, FieldDef} from '#components/molecules/DynamicFormFields';
import {FormInput} from '#components/molecules/FormInput';

import {PantryItemFormHeader} from './PantryItemFormHeader';
import {QuantitySection} from './QuantitySection';
import {StorageDetailsSection} from './StorageDetailsSection';

interface EditPantryItemFormData {
  quantity: number;
  reservedQuantity: string;
  storageState: StorageState;
  location: string;
  expirationDate?: Date;
  notes: string;
  category: string;
  tags: string[];
  isAutoReorder: boolean;
  autoReorderPoint: string;
}

const editItemSchema = yup.object({
  quantity: yup.number().min(1, 'Quantity must be at least 1').required(),
  reservedQuantity: yup.string(),
  storageState: yup.string().oneOf(Object.values(StorageState)),
  location: yup.string(),
  notes: yup.string(),
  category: yup.string(),
  autoReorderPoint: yup.string(),
});

interface EditPantryItemFormProps {
  itemId: string;
  onSuccess?: () => void;
}

export const EditPantryItemForm: React.FC<EditPantryItemFormProps> = ({
  itemId,
  onSuccess,
}) => {
  const {theme} = useUnistyles();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const {data: existingItemData, loading: itemLoading} = useGetPantryItemQuery({
    variables: {id: itemId},
    skip: !itemId,
  });

  const [updateItem] = useUpdatePantryItemMutation();

  const getInitialValues = (): EditPantryItemFormData => {
    if (existingItemData?.pantryItem) {
      const item = existingItemData.pantryItem;
      return {
        quantity: item.currentQuantity || 1,
        reservedQuantity: item.reservedQuantity?.toString() || '',
        storageState: item.storageState || StorageState.Ambient,
        location: item.storageLocation || '',
        expirationDate: item.expiresAt ? new Date(item.expiresAt) : undefined,
        notes: item.storageNotes || '',
        category: item.customCategory || '',
        tags: item.tags || [],
        isAutoReorder: item.isAutoReorder || false,
        autoReorderPoint: item.autoReorderPoint?.toString() || '',
      };
    }

    return {
      quantity: 1,
      reservedQuantity: '',
      storageState: StorageState.Ambient,
      location: '',
      notes: '',
      category: '',
      tags: [],
      isAutoReorder: false,
      autoReorderPoint: '',
    };
  };

  const {
    control,
    handleSubmit,
    formState: {errors},
    setValue,
    watch,
    reset,
  } = useForm<EditPantryItemFormData>({
    resolver: yupResolver(editItemSchema) as any,
    defaultValues: getInitialValues(),
    mode: 'onChange',
  });

  const watchedValues = watch();

  useEffect(() => {
    if (existingItemData?.pantryItem) {
      reset(getInitialValues());
    }
  }, [existingItemData, reset]);

  const handleIncrementQuantity = useCallback(() => {
    const current = watchedValues.quantity || 0;
    setValue('quantity', current + 1);
  }, [setValue, watchedValues.quantity]);

  const handleDecrementQuantity = useCallback(() => {
    const current = watchedValues.quantity || 1;
    setValue('quantity', Math.max(1, current - 1));
  }, [setValue, watchedValues.quantity]);

  const handleSave = async (data: EditPantryItemFormData) => {
    if (data.quantity <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    setSaving(true);
    try {
      await updateItem({
        variables: {
          id: itemId,
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

      onSuccess?.();
    } catch (error) {
      Alert.alert('Error', 'Failed to update pantry item');
    } finally {
      setSaving(false);
    }
  };

  if (itemLoading) {
    return (
      <View style={[commonStyles.container, commonStyles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const item = existingItemData?.pantryItem;
  if (!item) {
    return null;
  }

  // Tags section fields
  const tagsFields: FieldDef<EditPantryItemFormData>[] = [
    {
      name: 'tags',
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
  ];

  return (
    <KeyboardAvoidingView
      style={commonStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <PantryItemFormHeader
        title="Edit Pantry Item"
        onSave={handleSubmit(handleSave)}
        saving={saving}
      />

      <ScrollView
        style={commonStyles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={commonStyles.padding}>
          {/* Item Information Section - Read Only */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Item Information</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>
                {item.item?.name || 'Unknown Item'}
              </Text>
            </View>
          </View>

          <QuantitySection
            control={control}
            errors={errors}
            mode="edit"
            quantity={watchedValues.quantity}
            unit={item.unit?.symbol || ''}
            isAutoReorder={watchedValues.isAutoReorder}
            onIncrementQuantity={handleIncrementQuantity}
            onDecrementQuantity={handleDecrementQuantity}
          />

          <StorageDetailsSection
            control={control}
            errors={errors}
            mode="edit"
            storageState={watchedValues.storageState}
            expirationDate={watchedValues.expirationDate}
            showDatePicker={showDatePicker}
            onStorageStateChange={(state) => setValue('storageState', state)}
            onDatePickerToggle={() => setShowDatePicker(!showDatePicker)}
            onDateChange={(date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (date) setValue('expirationDate', date);
            }}
          />

          {/* Tags Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <DynamicFormFields
              fields={tagsFields}
              control={control}
              errors={errors}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
}));