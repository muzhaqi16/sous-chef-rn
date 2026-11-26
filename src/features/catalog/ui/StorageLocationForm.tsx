import React from 'react';
import { View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#styles/commonStyles';
import { StorageState, StorageType } from '#graphql/generated/schemaTypes';
import { FormInput } from '#components/atoms/FormInput';
import { FormTextArea } from '#components/atoms/FormTextArea';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';
import { StorageLocationIcon } from '#features/catalog/ui/StorageLocationIcon';
import { Text } from '#components/atoms/Text';
import {
  STORAGE_TYPE_VALUES,
  TEMPERATURE_OPTION_VALUES,
  COLOR_PRESETS,
  storageLocationSchema,
  type StorageLocationFields,
} from '#features/catalog/components/storageLocationFormConfig';
import { StorageLocationAdvancedSection } from '#features/catalog/components/StorageLocationAdvancedSection';
import { parseDecimalInput } from '#utils/parseDecimalInput';
import { formatNumberForInput } from '#utils/formatters/number';
import { firstNonBlank } from '#utils/firstNonBlank';
import { reportValidationErrors } from '#utils/validation/common';

/** Fields the form reads to seed its initial state. */
export interface StorageLocationFormInitialData {
  id?: string;
  name?: string;
  type?: StorageType;
  parentLocationId?: string | null;
  description?: string | null;
  temperature?: StorageState | null;
  color?: string | null;
  isClimateControlled?: boolean | null;
  capacity?: number | null;
  capacityUnit?: string | null;
  isDefault?: boolean | null;
}

/** Payload emitted by the form's `onSubmit`. */
export interface StorageLocationFormValues {
  name: string;
  type: StorageType;
  parentLocationId: string | null;
  description: string | null;
  temperature: StorageState | null;
  color: string | null;
  isClimateControlled: boolean | null;
  capacity: number | null;
  capacityUnit: string | null;
  /** Absent when editing the current default, which this form cannot unset. */
  isDefault?: boolean | null;
}

interface StorageLocationFormProps {
  initialData?: StorageLocationFormInitialData | null;
  /** Resolves `false` when the save was refused, which keeps the sheet open. */
  onSubmit: (data: StorageLocationFormValues) => Promise<boolean | void>;
  onClose: () => void;
  isSubmitting: boolean;
  availableLocations?: Array<{ id: string; name: string; type: StorageType }>;
}

/** A blank colour the server stored reads as "no colour", the swatch it selects. */
const seedFields = (
  initialData: StorageLocationFormInitialData | null | undefined,
): StorageLocationFields => ({
  name: initialData?.name ?? '',
  type: initialData?.type ?? StorageType.PantryShelf,
  parentLocationId: initialData?.parentLocationId ?? null,
  description: initialData?.description ?? '',
  temperature: initialData?.temperature ?? StorageState.None,
  color: firstNonBlank(initialData?.color) ?? null,
  isClimateControlled: initialData?.isClimateControlled ?? false,
  capacity: formatNumberForInput(initialData?.capacity),
  capacityUnit: initialData?.capacityUnit ?? '',
  isDefault: initialData?.isDefault ?? false,
});

/**
 * A storage location's form and its sheet's bar, mounted fresh each time the
 * sheet opens. A refused save keeps it open with what was entered.
 */
export const StorageLocationForm: React.FC<StorageLocationFormProps> = ({
  initialData,
  onSubmit,
  onClose,
  isSubmitting,
  availableLocations = [],
}) => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isDirty, errors },
  } = useForm<StorageLocationFields>({
    resolver: yupResolver(storageLocationSchema),
    defaultValues: seedFields(initialData),
  });
  useSheetUnsavedInput(isDirty);
  const type = useWatch({ control, name: 'type' });
  const parentLocationId = useWatch({ control, name: 'parentLocationId' });
  const temperature = useWatch({ control, name: 'temperature' });
  const color = useWatch({ control, name: 'color' });
  const isClimateControlled = useWatch({
    control,
    name: 'isClimateControlled',
  });
  const capacity = useWatch({ control, name: 'capacity' });
  const capacityUnit = useWatch({ control, name: 'capacityUnit' });
  const isDefault = useWatch({ control, name: 'isDefault' });

  // A location can't be its own parent.
  const parentOptions = availableLocations.filter(
    loc => loc.id !== initialData?.id,
  );

  const save = handleSubmit(async fields => {
    const capacityValue = parseDecimalInput(fields.capacity);
    const result = await onSubmit({
      name: fields.name,
      type: fields.type,
      parentLocationId: fields.parentLocationId,
      description: fields.description.trim() || null,
      temperature:
        fields.temperature !== StorageState.None ? fields.temperature : null,
      color: fields.color,
      // `null` reads as "unchanged" to the API, so an unticked box sends false.
      isClimateControlled: fields.isClimateControlled,
      capacity: capacityValue > 0 ? capacityValue : null,
      capacityUnit: fields.capacityUnit || null,
      // The API refuses unsetting the current default: it moves only by
      // another location taking it, so the current default states nothing.
      ...(initialData?.isDefault ? {} : { isDefault: fields.isDefault }),
    });
    if (result !== false) onClose();
  }, reportValidationErrors);

  const isEditing = !!initialData;

  return (
    <View>
      <SheetHeaderSlot>
        <SheetHeader
          title={
            isEditing
              ? t('storageLocationSheet.editTitle')
              : t('storageLocationSheet.addTitle')
          }
          onClose={onClose}
          confirm={{
            onPress: () => {
              void save();
            },
            accessibilityLabel: isEditing
              ? t('labels.update')
              : t('labels.create'),
            loading: isSubmitting,
          }}
        />
      </SheetHeaderSlot>
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <FormInput
            label={t('storageLocationForm.name')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            error={fieldState.error?.message}
            placeholder={t('storageLocationForm.namePlaceholder')}
            autoFocus
            required
          />
        )}
      />
      {/* Type Carousel */}
      <View style={[commonStyles.inputGroup, styles.carouselInputGroup]}>
        <Text role="label" tone="secondary" style={styles.fieldLabel}>
          {t('storageLocationForm.type')}
        </Text>
        <View style={styles.carouselContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.typeScroll}
            contentContainerStyle={styles.typeScrollContent}
          >
            {STORAGE_TYPE_VALUES.map(option => (
              <AppPressable
                key={option.value}
                style={
                  type === option.value
                    ? styles.typeButtonSelected
                    : styles.typeButton
                }
                onPress={() =>
                  setValue('type', option.value, { shouldDirty: true })
                }
              >
                <StorageLocationIcon type={option.value} size="lg" />
                <Text
                  role="label"
                  style={
                    type === option.value
                      ? styles.typeLabelSelected
                      : styles.typeLabel
                  }
                >
                  {t(`storageLocationForm.${option.key}`)}
                </Text>
              </AppPressable>
            ))}
          </ScrollView>
        </View>
      </View>
      {/* Parent Location Selector */}
      {parentOptions.length > 0 && (
        <View style={[commonStyles.inputGroup, styles.carouselInputGroup]}>
          <Text role="label" tone="secondary" style={styles.fieldLabel}>
            {t('storageLocationForm.parentLabel')}
          </Text>
          <View style={styles.carouselContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.parentScroll}
              contentContainerStyle={styles.typeScrollContent}
            >
              <AppPressable
                style={
                  !parentLocationId
                    ? styles.parentButtonSelected
                    : styles.parentButton
                }
                onPress={() =>
                  setValue('parentLocationId', null, { shouldDirty: true })
                }
              >
                <Text
                  role="label"
                  style={
                    !parentLocationId
                      ? styles.parentLabelSelected
                      : styles.parentLabel
                  }
                >
                  {t('storageLocationForm.parentNone')}
                </Text>
              </AppPressable>
              {parentOptions.map(location => (
                <AppPressable
                  key={location.id}
                  style={
                    parentLocationId === location.id
                      ? styles.parentButtonSelected
                      : styles.parentButton
                  }
                  onPress={() =>
                    setValue('parentLocationId', location.id, {
                      shouldDirty: true,
                    })
                  }
                >
                  <Text
                    role="label"
                    style={
                      parentLocationId === location.id
                        ? styles.parentLabelSelected
                        : styles.parentLabel
                    }
                  >
                    {location.name}
                  </Text>
                </AppPressable>
              ))}
            </ScrollView>
          </View>
          <Text role="caption" tone="secondary" style={styles.hint}>
            {t('storageLocationForm.parentHint')}
          </Text>
        </View>
      )}
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <FormTextArea
            ref={field.ref}
            label={t('storageLocationForm.descriptionLabel')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('storageLocationForm.descriptionPlaceholder')}
            numberOfLines={2}
          />
        )}
      />
      {/* Temperature */}
      <View style={[commonStyles.inputGroup, styles.carouselInputGroup]}>
        <Text role="label" tone="secondary" style={styles.fieldLabel}>
          {t('storageLocationForm.temperature')}
        </Text>
        <View style={styles.carouselContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.typeScroll}
            contentContainerStyle={styles.typeScrollContent}
          >
            {TEMPERATURE_OPTION_VALUES.map(option => (
              <AppPressable
                key={option.value}
                style={
                  temperature === option.value
                    ? styles.parentButtonSelected
                    : styles.parentButton
                }
                onPress={() =>
                  setValue('temperature', option.value, { shouldDirty: true })
                }
              >
                <Text
                  role="label"
                  style={
                    temperature === option.value
                      ? styles.parentLabelSelected
                      : styles.parentLabel
                  }
                >
                  {t(`storageLocationForm.${option.key}`)}
                </Text>
              </AppPressable>
            ))}
          </ScrollView>
        </View>
      </View>
      {/* Color */}
      <View style={[commonStyles.inputGroup, styles.carouselInputGroup]}>
        <Text role="label" tone="secondary" style={styles.fieldLabel}>
          {t('storageLocationForm.colorLabel')}
        </Text>
        <View style={styles.carouselContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.typeScroll}
            contentContainerStyle={styles.typeScrollContent}
          >
            <AppPressable
              style={
                !color ? styles.colorSwatchNoneSelected : styles.colorSwatchNone
              }
              onPress={() => setValue('color', null, { shouldDirty: true })}
            >
              <Text role="label" tone="secondary">
                -
              </Text>
            </AppPressable>
            {COLOR_PRESETS.map(preset => {
              // Hoisted: Reanimated's babel plugin wraps any
              // `{ x: foo.value }` in a `style={...}` in a false-positive
              // shared-value warning.
              const swatchColor = preset.value;
              return (
                <AppPressable
                  key={preset.value}
                  style={[
                    color === preset.value
                      ? styles.colorSwatchSelected
                      : styles.colorSwatch,
                    { backgroundColor: swatchColor },
                  ]}
                  onPress={() =>
                    setValue('color', preset.value, { shouldDirty: true })
                  }
                  accessibilityLabel={t(`storageLocationForm.${preset.key}`)}
                />
              );
            })}
          </ScrollView>
        </View>
      </View>
      <StorageLocationAdvancedSection
        isClimateControlled={isClimateControlled}
        capacity={capacity}
        capacityError={errors.capacity?.message}
        capacityUnit={capacityUnit}
        isDefault={isDefault}
        canChangeDefault={!initialData?.isDefault}
        onToggleClimateControlled={() =>
          setValue('isClimateControlled', !isClimateControlled, {
            shouldDirty: true,
          })
        }
        onCapacityChange={next =>
          // Re-checked only while refused, so a fix clears the message.
          setValue('capacity', next, {
            shouldDirty: true,
            shouldValidate: !!errors.capacity,
          })
        }
        onCapacityUnitChange={next =>
          setValue('capacityUnit', next, { shouldDirty: true })
        }
        onToggleDefault={() =>
          setValue('isDefault', !isDefault, { shouldDirty: true })
        }
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  carouselInputGroup: {
    overflow: 'visible',
  },
  // Bleeds the chip rows through the host sheet's gutter to its edges.
  carouselContainer: {
    marginHorizontal: -theme.layout.pageGutter,
    marginTop: theme.spacing.xs,
  },
  typeScroll: {
    flexGrow: 0,
  },
  typeScrollContent: {
    paddingHorizontal: theme.layout.pageGutter,
  },
  parentScroll: {
    marginTop: theme.spacing.xs,
  },
  typeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceVariant,
    marginRight: theme.spacing.sm,
    alignItems: 'center',
    minWidth: 90,
  },
  parentButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginRight: theme.spacing.sm,
    minWidth: 80,
  },
  typeButtonSelected: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    marginRight: theme.spacing.sm,
    alignItems: 'center',
    minWidth: 90,
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  parentButtonSelected: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    marginRight: theme.spacing.sm,
    minWidth: 80,
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  typeLabel: {
    color: theme.colors.textSecondary,
  },
  typeLabelSelected: {
    color: theme.colors.primaryText,
  },
  parentLabel: {
    color: theme.colors.textSecondary,
  },
  parentLabelSelected: {
    color: theme.colors.primaryText,
  },
  hint: {
    marginTop: theme.spacing.xs,
  },
  fieldLabel: {
    marginBottom: theme.spacing.sm,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    marginRight: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatchNone: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    marginRight: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  colorSwatchNoneSelected: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    marginRight: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: theme.borderWidth.thick,
    borderColor: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  colorSwatchSelected: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    marginRight: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: theme.borderWidth.thick,
    borderColor: theme.colors.textPrimary,
  },
}));
