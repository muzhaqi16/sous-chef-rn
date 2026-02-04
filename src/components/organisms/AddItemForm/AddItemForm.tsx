import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AnimatedButton } from '#/components/atoms/AnimatedButton';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { createItemSchema, CreateItemFormData } from '#utils/validation/item';
import { StorageState, ItemType } from '#generated';
import { FormInput } from '#/components/molecules/FormInput';
import { FormTextArea } from '#/components/molecules/FormTextArea';
import { FormNumberInput } from '#/components/molecules/FormNumberInput';
import { FormSelect } from '#/components/molecules/FormSelect';
import { FormCheckbox } from '#/components/molecules/FormCheckbox';
import { ProductImagePicker } from '#/components/molecules/ProductImagePicker';
import type { ImageFile } from '#/components/molecules/ImagePicker';
import { UnitsAutocompleteInput } from '#/components/molecules/UnitsAutocompleteInput';
import { BrandAutocompleteInput } from '#/components/molecules/BrandAutocompleteInput';
import { DynamicFormFields, type FieldDef } from '#/components/molecules/DynamicFormFields';

interface AddItemFormProps {
  barcode?: string;
  format?: string;
  scannedValue?: string; // The actual scanned value (could be barcode or SKU)
  onSubmit: (formData: CreateItemFormData) => void;
  onClose: () => void;
  loading?: boolean;
  title?: string;
  enableAutocomplete?: boolean;
}

const STORAGE_STATES = Object.values(StorageState);
const ITEM_TYPES = Object.values(ItemType);

// Helper function to detect if scanned value is barcode or SKU
const detectScanType = (value: string): 'barcode' | 'sku' => {
  // Common barcode formats (UPC, EAN, etc.) are typically 8, 12, 13, or 14 digits
  const isNumericBarcode = /^\d{8}(\d{4,6})?$/.test(value);

  // If it's all digits and matches common barcode lengths, treat as barcode
  if (isNumericBarcode) {
    return 'barcode';
  }

  // Otherwise, treat as SKU (alphanumeric codes, shorter codes, etc.)
  return 'sku';
};

const getFormSections = (
  setSelectedBrandId: (id: string | null) => void,
  setSelectedUnitId: (id: string | null) => void,
): Array<{
  title: string;
  fields: FieldDef<CreateItemFormData>[];
}> => [
  {
    title: 'Basic Information',
    fields: [
      {
        name: 'name',
        label: 'Item Name',
        placeholder: 'Enter item name',
        component: FormInput,
        props: { autoCapitalize: 'words', required: true },
      },
      {
        name: 'description',
        label: 'Description',
        placeholder: 'Enter item description (optional)',
        component: FormTextArea,
        props: { numberOfLines: 3 },
      },
      {
        name: 'sku',
        label: 'SKU',
        placeholder: 'Enter SKU (optional)',
        component: FormInput,
      },
      {
        name: 'upc',
        label: 'UPC/Barcode',
        placeholder: 'Enter UPC/Barcode (optional)',
        component: FormInput,
        props: { keyboardType: 'numeric' },
      },
    ],
  },
  {
    title: 'Product Details',
    fields: [
      {
        name: 'type',
        label: 'Item Type',
        component: FormSelect,
        props: { componentType: 'select' },
        options: ITEM_TYPES.map(type => ({ label: type, value: type })),
      },
      {
        name: 'storageState',
        label: 'Storage State',
        component: FormSelect,
        props: { componentType: 'select' },
        options: STORAGE_STATES.map(state => ({ label: state, value: state })),
      },
      {
        name: 'shelfLifeDays',
        label: 'Shelf Life (Days)',
        placeholder: 'Enter shelf life in days',
        component: FormNumberInput,
        props: { componentType: 'number', keyboardType: 'numeric' },
      },
    ],
  },
  {
    title: 'Brand & Vendor',
    fields: [
      {
        name: 'vendor',
        label: 'Brand/Vendor',
        placeholder: 'Enter brand or vendor name',
        component: BrandAutocompleteInput,
        props: {
          componentType: 'autocomplete',
          onBrandSelected: (brandId: string | null) =>
            setSelectedBrandId(brandId),
        },
      },
    ],
  },
  {
    title: 'Weight & Units',
    fields: [
      {
        name: 'netWeight',
        label: 'Net Weight',
        placeholder: 'Enter net weight',
        component: FormNumberInput,
        props: { componentType: 'number', keyboardType: 'decimal-pad' },
      },
      {
        name: 'displayUnitId',
        label: 'Display Unit',
        placeholder: 'kg, lbs, pcs, etc.',
        component: UnitsAutocompleteInput,
        props: {
          componentType: 'autocomplete',
          onUnitSelected: (unitId: string | null) => setSelectedUnitId(unitId),
        },
      },
    ],
  },
  {
    title: 'Tags & Metadata',
    fields: [
      {
        name: 'tags',
        label: 'Tags',
        placeholder: 'Comma-separated tags (e.g., organic, gluten-free)',
        component: FormTextArea,
        props: { numberOfLines: 2 },
        renderValue: (value: any) => {
          if (Array.isArray(value)) {
            return value.join(', ');
          }
          return value || '';
        },
        transformValue: (value: string) => {
          if (!value || typeof value !== 'string') return [];
          return value
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
        },
        transformOnBlur: true,
      },
    ],
  },
  {
    title: 'Item Flags',
    fields: [
      {
        name: 'isFoodStampItem',
        label: 'Food Stamp Eligible',
        component: FormCheckbox,
        props: { componentType: 'checkbox' },
      },
      {
        name: 'isFsaEligible',
        label: 'FSA Eligible',
        component: FormCheckbox,
        props: { componentType: 'checkbox' },
      },
    ],
  },
];

const AddItemForm: React.FC<AddItemFormProps> = ({
  barcode,
  format,
  scannedValue,
  onSubmit,
  onClose,
  loading = false,
  title = 'Add New Item',
}) => {
  // Track selected brand and unit IDs separately from the display names
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);

  // Determine what to populate based on scanned value
  const getInitialValues = () => {
    const values: any = {
      name: '',
      description: '',
      sku: '',
      upc: '',
      netWeight: undefined,
      displayUnitId: '',
      categoryIds: [],
      units: [],
      imageUrl: '',
      tags: [],
      storageState: StorageState.Ambient,
      type: ItemType.Foundation,
      shelfLifeDays: undefined,
      vendor: '',
      isFoodStampItem: false,
      isFsaEligible: false,
    };

    // If we have a scanned value, detect and populate the appropriate field
    if (scannedValue) {
      const scanType = detectScanType(scannedValue);
      if (scanType === 'barcode') {
        values.upc = scannedValue;
      } else {
        values.sku = scannedValue;
      }
    } else if (barcode) {
      // Fallback to legacy barcode prop
      values.upc = barcode;
    }

    return values;
  };

  // Get form sections with access to setSelectedBrandId and setSelectedUnitId
  const FORM_SECTIONS = getFormSections(setSelectedBrandId, setSelectedUnitId);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<CreateItemFormData>({
    resolver: yupResolver(createItemSchema) as any,
    defaultValues: getInitialValues(),
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

    // Process brand field - send both ID and name when available
    let brandId: string | undefined;
    let brandName: string | undefined;
    if (selectedBrandId) {
      brandId = selectedBrandId;
      brandName = data.vendor; // The display name from the form
    } else if (data.vendor) {
      // Only name provided (manual entry)
      brandName = data.vendor;
    }

    // Process display unit - send both ID and name when available
    let displayUnitId: string | undefined;
    let displayUnitName: string | undefined;
    if (selectedUnitId) {
      displayUnitId = selectedUnitId;
      displayUnitName = data.displayUnitId; // The display name from the form
    } else if (data.displayUnitId) {
      // Only name provided (manual entry)
      displayUnitName = data.displayUnitId;
    }

    // Process units array - create a basic unit entry if unit info is provided
    let units: any[] = [];
    if ((displayUnitId || displayUnitName) && data.netWeight) {
      const unitEntry: any = {
        isDefault: true,
        packageSize: data.netWeight,
      };

      if (displayUnitId) {
        unitEntry.unitId = displayUnitId;
      }
      if (displayUnitName) {
        unitEntry.unitName = displayUnitName;
      }

      units = [unitEntry];
    }

    const processedData = {
      name: data.name,
      description: data.description || undefined,
      upc: data.upc || undefined,
      sku: data.sku || undefined,
      netWeight: data.netWeight || undefined,
      displayUnitId: displayUnitId || undefined,
      displayUnitName: displayUnitName || undefined,
      type: data.type,
      storageState: data.storageState,
      shelfLifeDays: data.shelfLifeDays || undefined,
      imageUrl: data.imageUrl || undefined,
      brandId: brandId || undefined,
      brandName: brandName || undefined,
      categoryIds:
        data.categoryIds && data.categoryIds.length > 0
          ? data.categoryIds
          : undefined,
      units: units.length > 0 ? units : undefined,
      tags:
        tags.length > 0 || systemTags.length > 0
          ? [...tags, ...systemTags]
          : undefined,
      // Pass the selected image for post-creation upload
      selectedImage: selectedImage,
    };

    onSubmit(processedData);
  };

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {barcode
            ? 'Add this item to the database for future scans'
            : 'Create a new item with basic information'}
        </Text>
      </View>

      {(scannedValue || barcode) && (
        <View style={styles.barcodeInfo}>
          <Text style={styles.barcodeLabel}>
            {scannedValue && detectScanType(scannedValue) === 'sku'
              ? 'SKU'
              : 'UPC/Barcode'}
          </Text>
          <Text style={styles.barcodeValue}>{scannedValue || barcode}</Text>
          {format && (
            <>
              <Text style={styles.formatLabel}>Format</Text>
              <Text style={styles.formatValue}>{format.toUpperCase()}</Text>
            </>
          )}
        </View>
      )}

      <View style={styles.form}>
        {FORM_SECTIONS.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <DynamicFormFields
              fields={section.fields}
              control={control}
              errors={errors}
            />
          </View>
        ))}

        {/* Image Picker Section */}
        <View style={styles.section}>
          <ProductImagePicker
            selectedImage={selectedImage}
            onImageSelected={setSelectedImage}
            onImageRemoved={() => setSelectedImage(null)}
            onError={error => {
              console.error('Image selection error:', error);
            }}
            disabled={loading}
          />
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <AnimatedButton
          variant="primary"
          fullWidth
          loading={loading}
          disabled={!isValid}
          onPress={handleSubmit(handleFormSubmit)}
        >
          Add Item
        </AnimatedButton>

        <AnimatedButton
          variant="secondary"
          fullWidth
          disabled={loading}
          onPress={onClose}
        >
          Cancel
        </AnimatedButton>
      </View>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fonts.size['2xl'],
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  barcodeInfo: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.lg,
  },
  barcodeLabel: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  barcodeValue: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    fontFamily: 'monospace',
    marginBottom: theme.spacing.sm,
  },
  formatLabel: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  formatValue: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textOnSurfaceVariant,
  },
  form: {
    marginBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  buttonContainer: {
    gap: 12,
    paddingBottom: theme.spacing.lg,
  },
}));

export default AddItemForm;
