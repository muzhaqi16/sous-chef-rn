import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View, TextInput, ActivityIndicator } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { StorageState } from '#/graphql/generated/schemaTypes';
import { FormTextArea } from '#components/molecules/FormTextArea';
import { StorageLocationIcon } from '#components/atoms/StorageLocationIcon';
import { Text } from '#components/atoms/Text';
import {
  STORAGE_TYPE_VALUES,
  TEMPERATURE_OPTION_VALUES,
  COLOR_PRESETS,
} from './storageLocationFormConfig';
import { StorageLocationAdvancedSection } from './StorageLocationAdvancedSection';

export interface StorageLocationFormRef {
  submit: () => void;
  isValid: () => boolean;
}

/** Fields the form reads to seed its initial state. */
export interface StorageLocationFormInitialData {
  id?: string;
  name?: string;
  type?: string;
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
  type: string;
  icon: string | null;
  parentLocationId: string | null;
  description: string | null;
  temperature: StorageState | null;
  color: string | null;
  isClimateControlled: boolean | null;
  capacity: number | null;
  capacityUnit: string | null;
  isDefault: boolean | null;
}

interface StorageLocationFormProps {
  initialData?: StorageLocationFormInitialData | null;
  onSubmit: (data: StorageLocationFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  availableLocations?: Array<{ id: string; name: string; type: string }>;
  hideActions?: boolean;
}

export const StorageLocationForm = forwardRef<
  StorageLocationFormRef,
  StorageLocationFormProps
>(
  (
    {
      initialData,
      onSubmit,
      onCancel,
      isSubmitting,
      availableLocations = [],
      hideActions = false,
    },
    ref,
  ) => {
    const { t } = useTranslation();

    const [formData, setFormData] = useState({
      name: initialData?.name || '',
      type: initialData?.type || 'PANTRY_SHELF',
      parentLocationId: initialData?.parentLocationId || undefined,
      description: initialData?.description || '',
      temperature: initialData?.temperature || StorageState.None,
      color: initialData?.color || (null as string | null),
      isClimateControlled: initialData?.isClimateControlled || false,
      capacity:
        initialData?.capacity != null ? String(initialData.capacity) : '',
      capacityUnit: initialData?.capacityUnit || '',
      isDefault: initialData?.isDefault || false,
    });

    // Sync form data when initialData changes (render-time state update)
    const [prevInitialData, setPrevInitialData] = useState(initialData);
    if (initialData !== prevInitialData) {
      setPrevInitialData(initialData);
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          type: initialData.type || 'PANTRY_SHELF',
          parentLocationId: initialData.parentLocationId || undefined,
          description: initialData.description || '',
          temperature: initialData.temperature || StorageState.None,
          color: initialData.color || null,
          isClimateControlled: initialData.isClimateControlled || false,
          capacity:
            initialData.capacity != null ? String(initialData.capacity) : '',
          capacityUnit: initialData.capacityUnit || '',
          isDefault: initialData.isDefault || false,
        });
      }
    }

    // Filter out current location from parent options (can't be its own parent)
    const parentOptions = availableLocations.filter(
      loc => loc.id !== initialData?.id,
    );

    const handleSubmit = () => {
      if (!formData.name.trim()) {
        return;
      }

      const capacityFloat = formData.capacity
        ? parseFloat(formData.capacity)
        : null;

      const finalData = {
        name: formData.name.trim(),
        type: formData.type,
        icon: null,
        parentLocationId: formData.parentLocationId || null,
        description: formData.description.trim() || null,
        temperature:
          formData.temperature !== StorageState.None
            ? formData.temperature
            : null,
        color: formData.color || null,
        isClimateControlled: formData.isClimateControlled || null,
        capacity: capacityFloat && !isNaN(capacityFloat) ? capacityFloat : null,
        capacityUnit: formData.capacityUnit || null,
        isDefault: formData.isDefault || null,
      };

      onSubmit(finalData);
    };

    const isValid = () => formData.name.trim().length > 0;

    useImperativeHandle(ref, () => ({
      submit: handleSubmit,
      isValid,
    }));

    return (
      <View style={styles.container}>
        {/* Name */}
        <View style={commonStyles.inputGroup}>
          <Text style={commonStyles.label}>
            {t('storageLocationForm.name')}
          </Text>
          <TextInput
            style={commonStyles.input}
            value={formData.name}
            onChangeText={name => setFormData({ ...formData, name })}
            placeholder={t('storageLocationForm.namePlaceholder')}
            autoFocus
          />
        </View>

        {/* Type Carousel */}
        <View style={[commonStyles.inputGroup, styles.carouselInputGroup]}>
          <Text style={commonStyles.label}>
            {t('storageLocationForm.type')}
          </Text>
          <View style={styles.carouselContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.typeScroll}
              contentContainerStyle={styles.typeScrollContent}
            >
              {STORAGE_TYPE_VALUES.map(type => (
                <Pressable
                  key={type.value}
                  style={({ pressed }) => [
                    formData.type === type.value
                      ? styles.typeButtonSelected
                      : styles.typeButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    setFormData({
                      ...formData,
                      type: type.value,
                    })
                  }
                >
                  <StorageLocationIcon type={type.value} size={28} />
                  <Text
                    size="xs"
                    weight={
                      formData.type === type.value ? 'semibold' : 'medium'
                    }
                    style={
                      formData.type === type.value
                        ? styles.typeLabelSelected
                        : styles.typeLabel
                    }
                  >
                    {t(`storageLocationForm.${type.key}`)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Parent Location Selector */}
        {parentOptions.length > 0 && (
          <View style={[commonStyles.inputGroup, styles.carouselInputGroup]}>
            <Text style={commonStyles.label}>
              {t('storageLocationForm.parentLabel')}
            </Text>
            <View style={styles.carouselContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.parentScroll}
                contentContainerStyle={styles.typeScrollContent}
              >
                <Pressable
                  style={({ pressed }) => [
                    !formData.parentLocationId
                      ? styles.parentButtonSelected
                      : styles.parentButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    setFormData({ ...formData, parentLocationId: undefined })
                  }
                >
                  <Text
                    size="sm"
                    weight={!formData.parentLocationId ? 'semibold' : 'medium'}
                    style={
                      !formData.parentLocationId
                        ? styles.parentLabelSelected
                        : styles.parentLabel
                    }
                  >
                    {t('storageLocationForm.parentNone')}
                  </Text>
                </Pressable>
                {parentOptions.map(location => (
                  <Pressable
                    key={location.id}
                    style={({ pressed }) => [
                      formData.parentLocationId === location.id
                        ? styles.parentButtonSelected
                        : styles.parentButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() =>
                      setFormData({
                        ...formData,
                        parentLocationId: location.id,
                      })
                    }
                  >
                    <Text
                      size="sm"
                      weight={
                        formData.parentLocationId === location.id
                          ? 'semibold'
                          : 'medium'
                      }
                      style={
                        formData.parentLocationId === location.id
                          ? styles.parentLabelSelected
                          : styles.parentLabel
                      }
                    >
                      {location.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <Text size="xs" tone="secondary" style={styles.hint}>
              {t('storageLocationForm.parentHint')}
            </Text>
          </View>
        )}

        {/* Description */}
        <FormTextArea
          label={t('storageLocationForm.descriptionLabel')}
          value={formData.description}
          onChangeText={description =>
            setFormData({ ...formData, description })
          }
          placeholder={t('storageLocationForm.descriptionPlaceholder')}
          numberOfLines={2}
        />

        {/* Temperature */}
        <View style={[commonStyles.inputGroup, styles.carouselInputGroup]}>
          <Text style={commonStyles.label}>
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
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    formData.temperature === option.value
                      ? styles.parentButtonSelected
                      : styles.parentButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    setFormData({ ...formData, temperature: option.value })
                  }
                >
                  <Text
                    size="sm"
                    weight={
                      formData.temperature === option.value
                        ? 'semibold'
                        : 'medium'
                    }
                    style={
                      formData.temperature === option.value
                        ? styles.parentLabelSelected
                        : styles.parentLabel
                    }
                  >
                    {t(`storageLocationForm.${option.key}`)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Color */}
        <View style={[commonStyles.inputGroup, styles.carouselInputGroup]}>
          <Text style={commonStyles.label}>
            {t('storageLocationForm.colorLabel')}
          </Text>
          <View style={styles.carouselContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.typeScroll}
              contentContainerStyle={styles.typeScrollContent}
            >
              <Pressable
                style={({ pressed }) => [
                  !formData.color
                    ? styles.colorSwatchNoneSelected
                    : styles.colorSwatchNone,
                  pressed && styles.pressed,
                ]}
                onPress={() => setFormData({ ...formData, color: null })}
              >
                <Text size="sm" tone="secondary" weight="medium">
                  -
                </Text>
              </Pressable>
              {COLOR_PRESETS.map(preset => (
                <Pressable
                  key={preset.value}
                  style={({ pressed }) => [
                    formData.color === preset.value
                      ? styles.colorSwatchSelected
                      : styles.colorSwatch,
                    { backgroundColor: preset.value },
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    setFormData({ ...formData, color: preset.value })
                  }
                  accessibilityLabel={t(`storageLocationForm.${preset.key}`)}
                />
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Advanced Settings Collapsible */}
        <StorageLocationAdvancedSection
          isClimateControlled={formData.isClimateControlled}
          capacity={formData.capacity}
          capacityUnit={formData.capacityUnit}
          isDefault={formData.isDefault}
          onToggleClimateControlled={() =>
            setFormData({
              ...formData,
              isClimateControlled: !formData.isClimateControlled,
            })
          }
          onCapacityChange={capacity => setFormData({ ...formData, capacity })}
          onCapacityUnitChange={capacityUnit =>
            setFormData({ ...formData, capacityUnit })
          }
          onToggleDefault={() =>
            setFormData({ ...formData, isDefault: !formData.isDefault })
          }
        />

        {!hideActions && (
          <View style={[commonStyles.row, styles.formActions]}>
            <Pressable
              style={({ pressed }) => [
                commonStyles.button,
                commonStyles.buttonSecondary,
                pressed && styles.pressed,
              ]}
              onPress={onCancel}
              disabled={isSubmitting}
            >
              <Text style={commonStyles.buttonTextSecondary}>
                {t('labels.cancel')}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                commonStyles.button,
                commonStyles.buttonPrimary,
                pressed && styles.pressed,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={commonStyles.buttonTextPrimary}>
                  {initialData ? t('labels.update') : t('labels.create')}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create(theme => ({
  container: {
    paddingHorizontal: theme.spacing.lg,
  },
  carouselInputGroup: {
    overflow: 'visible',
  },
  carouselContainer: {
    marginHorizontal: -theme.spacing.lg,
    marginTop: theme.spacing.xs,
  },
  typeScroll: {
    flexGrow: 0,
  },
  typeScrollContent: {
    paddingHorizontal: theme.spacing.lg,
  },
  parentScroll: {
    marginTop: theme.spacing.xs,
  },
  typeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
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
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginRight: theme.spacing.sm,
    minWidth: 80,
  },
  typeButtonSelected: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
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
    borderWidth: 1,
    marginRight: theme.spacing.sm,
    minWidth: 80,
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  typeIcon: {
    marginBottom: theme.spacing.xs,
  },
  typeLabel: {
    color: theme.colors.textSecondary,
  },
  typeLabelSelected: {
    color: theme.colors.primary,
  },
  parentLabel: {
    color: theme.colors.textSecondary,
  },
  parentLabelSelected: {
    color: theme.colors.primary,
  },
  hint: {
    marginTop: theme.spacing.xs,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatchNone: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  colorSwatchNoneSelected: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  colorSwatchSelected: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.textPrimary,
  },
  formActions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
