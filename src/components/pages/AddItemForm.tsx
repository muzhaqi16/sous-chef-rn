import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useForm, Controller} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import {createItemSchema, CreateItemFormData} from '#utils/validation';
import {
  StorageState,
  ItemType,
  DataSource,
  ItemStatus,
  Visibility,
} from '#generated';
import {FormInput} from '../molecules/FormInput';
import {FormTextArea} from '../molecules/FormTextArea';
import {FormNumberInput} from '../molecules/FormNumberInput';
import {FormSelect} from '../molecules/FormSelect';
import {FormCheckbox} from '../molecules/FormCheckbox';
import {UnitsAutocompleteInput} from '../molecules/UnitsAutocompleteInput';
import {BrandAutocompleteInput} from '../molecules/BrandAutocompleteInput';

interface AddItemFormProps {
  barcode?: string;
  format?: string;
  onSubmit: (formData: CreateItemFormData) => void;
  onClose: () => void;
  loading?: boolean;
  title?: string;
  enableAutocomplete?: boolean;
}

const STORAGE_STATES = Object.values(StorageState);
const ITEM_TYPES = Object.values(ItemType);
const DATA_SOURCES = Object.values(DataSource);
const ITEM_STATUSES = Object.values(ItemStatus);
const VISIBILITY_OPTIONS = Object.values(Visibility);

const AddItemForm: React.FC<AddItemFormProps> = ({
  barcode,
  format,
  onSubmit,
  onClose,
  loading = false,
  title = 'Add New Item',
  enableAutocomplete = false,
}) => {
  const {
    control,
    handleSubmit,
    formState: {errors, isValid},
    setValue,
    watch,
  } = useForm<CreateItemFormData>({
    resolver: yupResolver(createItemSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      barcode: barcode || '',
      price: undefined,
      imageUrl: '',
      storageState: StorageState.Ambient,
      type: ItemType.Foundation,
      dataSource: DataSource.Manual,
      status: ItemStatus.Active,
      visibility: Visibility.Public,
      showInOnboarding: false,
      isFoodStampItem: false,
      isFsaEligible: false,
    },
    mode: 'onChange',
  });

  const handleFormSubmit = (data: CreateItemFormData) => {
    // Process existing tags
    let tags: string[] = [];
    if (data.tags) {
      if (Array.isArray(data.tags)) {
        tags = data.tags.filter((tag): tag is string => Boolean(tag));
      } else if (typeof data.tags === 'string') {
        tags = (data.tags as string)
          .split(',')
          .map((tag: string) => tag.trim())
          .filter(Boolean);
      }
    }

    // Add system tags based on boolean flags
    const systemTags: string[] = [];

    // Add tags when checkboxes are checked
    if (data.isFoodStampItem) {
      systemTags.push('food-stamp-eligible');
    }
    if (data.isFsaEligible) {
      systemTags.push('fsa-eligible');
    }

    const processedData = {
      ...data,
      // Remove the checkbox-only fields from the data sent to the API
      isFoodStampItem: undefined,
      isFsaEligible: undefined,
      tags:
        tags.length > 0 || systemTags.length > 0
          ? [...tags, ...systemTags]
          : undefined,
    };

    onSubmit(processedData);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {barcode
              ? 'Add this item to the database for future scans'
              : 'Create a new item with basic information'}
          </Text>
        </View>

        {barcode && (
          <View style={styles.barcodeInfo}>
            <Text style={styles.barcodeLabel}>Barcode</Text>
            <Text style={styles.barcodeValue}>{barcode}</Text>
            {format && (
              <>
                <Text style={styles.formatLabel}>Format</Text>
                <Text style={styles.formatValue}>{format.toUpperCase()}</Text>
              </>
            )}
          </View>
        )}

        <View style={styles.form}>
          {/* Basic Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            {/* Item Name */}
            <Controller
              control={control}
              name="name"
              render={({field: {onChange, onBlur, value}}) => (
                <FormInput
                  label="Item Name"
                  placeholder="Enter item name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.name?.message}
                  required
                  autoCapitalize="words"
                  autoFocus
                />
              )}
            />

            {/* Description */}
            <Controller
              control={control}
              name="description"
              render={({field: {onChange, onBlur, value}}) => (
                <FormTextArea
                  label="Description"
                  placeholder="Enter item description (optional)"
                  value={value || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.description?.message}
                  numberOfLines={3}
                />
              )}
            />

            {/* SKU */}
            <Controller
              control={control}
              name="sku"
              render={({field: {onChange, onBlur, value}}) => (
                <FormInput
                  label="SKU"
                  placeholder="Enter SKU (optional)"
                  value={value || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.sku?.message}
                />
              )}
            />

            {/* FDC ID */}
            <Controller
              control={control}
              name="fdcId"
              render={({field: {onChange, onBlur, value}}) => (
                <FormInput
                  label="FDC ID"
                  placeholder="Enter FDC ID (optional)"
                  value={value || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.fdcId?.message}
                />
              )}
            />
          </View>

          {/* Product Details Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Details</Text>

            {/* Item Type */}
            <Controller
              control={control}
              name="type"
              render={({field: {onChange, value}}) => (
                <FormSelect
                  label="Item Type"
                  value={value || ''}
                  onValueChange={onChange}
                  options={ITEM_TYPES.map(type => ({label: type, value: type}))}
                />
              )}
            />

            {/* Storage State */}
            <Controller
              control={control}
              name="storageState"
              render={({field: {onChange, value}}) => (
                <FormSelect
                  label="Storage State"
                  value={value || ''}
                  onValueChange={onChange}
                  options={STORAGE_STATES.map(state => ({
                    label: state,
                    value: state,
                  }))}
                />
              )}
            />

            {/* Shelf Life Days */}
            <Controller
              control={control}
              name="shelfLifeDays"
              render={({field: {onChange, onBlur, value}}) => (
                <FormNumberInput
                  label="Shelf Life (Days)"
                  placeholder="Enter shelf life in days"
                  value={value?.toString() || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.shelfLifeDays?.message}
                  keyboardType="numeric"
                />
              )}
            />

            {/* Display Item Size */}
            <Controller
              control={control}
              name="displayItemSize"
              render={({field: {onChange, onBlur, value}}) => (
                <FormInput
                  label="Display Item Size"
                  placeholder="e.g., 500g, 1L, Large"
                  value={value || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.displayItemSize?.message}
                />
              )}
            />
          </View>

          {/* Pricing Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing</Text>

            {/* Price */}
            <Controller
              control={control}
              name="price"
              render={({field: {onChange, onBlur, value}}) => (
                <FormNumberInput
                  label="Price"
                  placeholder="0.00"
                  value={value?.toString() || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.price?.message}
                  keyboardType="decimal-pad"
                />
              )}
            />

            {/* Average Price */}
            <Controller
              control={control}
              name="averagePrice"
              render={({field: {onChange, onBlur, value}}) => (
                <FormNumberInput
                  label="Average Price"
                  placeholder="0.00"
                  value={value?.toString() || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.averagePrice?.message}
                  keyboardType="decimal-pad"
                />
              )}
            />

            {/* Unit Price */}
            <Controller
              control={control}
              name="unitPrice"
              render={({field: {onChange, onBlur, value}}) => (
                <FormNumberInput
                  label="Unit Price"
                  placeholder="0.00"
                  value={value?.toString() || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.unitPrice?.message}
                  keyboardType="decimal-pad"
                />
              )}
            />
          </View>

          {/* Brand & Vendor Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Brand & Vendor</Text>

            {/* Brand/Vendor with Autocomplete */}
            <Controller
              control={control}
              name="vendor"
              render={({field: {onChange, value}}) => (
                <BrandAutocompleteInput
                  label="Brand/Vendor"
                  placeholder="Enter brand or vendor name"
                  value={value || ''}
                  onChangeText={onChange}
                  error={errors.vendor?.message}
                />
              )}
            />
          </View>

          {/* Units Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Units</Text>

            {/* Unit Quantity */}
            <Controller
              control={control}
              name="unitQty"
              render={({field: {onChange, onBlur, value}}) => (
                <FormNumberInput
                  label="Unit Quantity"
                  placeholder="1.0"
                  value={value?.toString() || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.unitQty?.message}
                  keyboardType="decimal-pad"
                />
              )}
            />

            {/* Default Unit with Autocomplete */}
            <Controller
              control={control}
              name="defaultUnit"
              render={({field: {onChange, value}}) => (
                <UnitsAutocompleteInput
                  label="Default Unit"
                  placeholder="kg, lbs, pcs, etc."
                  value={value || ''}
                  onChangeText={onChange}
                  error={errors.defaultUnit?.message}
                />
              )}
            />
          </View>

          {/* Images Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Images</Text>

            {/* Image URL */}
            <Controller
              control={control}
              name="imageUrl"
              render={({field: {onChange, onBlur, value}}) => (
                <FormInput
                  label="Image URL"
                  placeholder="https://example.com/image.jpg"
                  value={value || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.imageUrl?.message}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              )}
            />
          </View>

          {/* Tags & Metadata Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags & Metadata</Text>

            {/* Tags */}
            <Controller
              control={control}
              name="tags"
              render={({field: {onChange, onBlur, value}}) => (
                <FormInput
                  label="Tags"
                  placeholder="Comma-separated tags (e.g., organic, gluten-free)"
                  value={Array.isArray(value) ? value.join(', ') : value || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.tags?.message}
                />
              )}
            />

            {/* Popularity */}
            <Controller
              control={control}
              name="popularity"
              render={({field: {onChange, onBlur, value}}) => (
                <FormNumberInput
                  label="Popularity Score"
                  placeholder="0-100"
                  value={value?.toString() || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.popularity?.message}
                  keyboardType="numeric"
                />
              )}
            />
          </View>

          {/* Flags Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Item Flags</Text>

            {/* Show in Onboarding */}
            <Controller
              control={control}
              name="showInOnboarding"
              render={({field: {onChange, value}}) => (
                <FormCheckbox
                  label="Show in Onboarding"
                  checked={value || false}
                  onPress={() => onChange(!value)}
                />
              )}
            />

            {/* Food Stamp Item */}
            <Controller
              control={control}
              name="isFoodStampItem"
              render={({field: {onChange, value}}) => (
                <FormCheckbox
                  label="Food Stamp Eligible"
                  checked={value || false}
                  onPress={() => onChange(!value)}
                />
              )}
            />

            {/* FSA Eligible */}
            <Controller
              control={control}
              name="isFsaEligible"
              render={({field: {onChange, value}}) => (
                <FormCheckbox
                  label="FSA Eligible"
                  checked={value || false}
                  onPress={() => onChange(!value)}
                />
              )}
            />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleSubmit(handleFormSubmit)}
            disabled={loading || !isValid}>
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Add Item</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={onClose}
            disabled={loading}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },
  barcodeInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  barcodeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  barcodeValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212529',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  formatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  formatValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
  },
  form: {
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  buttonContainer: {
    gap: 12,
    paddingBottom: 20,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#62B1F6',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  secondaryButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '500',
  },
}));

export default AddItemForm;
