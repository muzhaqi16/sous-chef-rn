import React, {
  useState,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { View, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { StorageState } from '#/graphql/generated/schemaTypes';
import { FormTextArea } from '#components/molecules/FormTextArea';
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { FormNumberInput } from '#components/molecules/FormNumberInput';
import { FormSelect } from '#components/molecules/FormSelect';
import { Icon } from '#utils/iconUtils';
import { StorageLocationIcon } from '#components/atoms/StorageLocationIcon';
import { SPRING, TIMING } from '#/constants/animations';
import { Text } from '#components/atoms/Text';

export interface StorageLocationFormRef {
  submit: () => void;
  isValid: () => boolean;
}

type TFn = ReturnType<typeof useTranslation>['t'];

const STORAGE_TYPE_VALUES = [
  { key: 'typeRefrigerator', value: 'REFRIGERATOR' },
  { key: 'typeFreezer', value: 'FREEZER' },
  { key: 'typePantryShelf', value: 'PANTRY_SHELF' },
  { key: 'typeCabinet', value: 'CABINET' },
  { key: 'typeDrawer', value: 'DRAWER' },
  { key: 'typeCounter', value: 'COUNTER' },
  { key: 'typeBasement', value: 'BASEMENT' },
  { key: 'typeGarage', value: 'GARAGE' },
  { key: 'typeCloset', value: 'CLOSET' },
  { key: 'typeOutdoor', value: 'OUTDOOR' },
  { key: 'typeBoatStorage', value: 'BOAT_STORAGE' },
  { key: 'typeRvStorage', value: 'RV_STORAGE' },
  { key: 'typeCustom', value: 'CUSTOM' },
];

const TEMPERATURE_OPTION_VALUES: Array<{ key: string; value: StorageState }> = [
  { key: 'tempNone', value: StorageState.None },
  { key: 'tempAmbient', value: StorageState.Ambient },
  { key: 'tempRefrigerated', value: StorageState.Refrigerated },
  { key: 'tempFrozen', value: StorageState.Frozen },
];

const COLOR_PRESETS = [
  { key: 'colorRed', value: '#E53935' },
  { key: 'colorPink', value: '#D81B60' },
  { key: 'colorPurple', value: '#8E24AA' },
  { key: 'colorBlue', value: '#1E88E5' },
  { key: 'colorTeal', value: '#00897B' },
  { key: 'colorGreen', value: '#43A047' },
  { key: 'colorOrange', value: '#FB8C00' },
  { key: 'colorBrown', value: '#6D4C41' },
  { key: 'colorGrey', value: '#757575' },
  { key: 'colorIndigo', value: '#3949AB' },
];

const CAPACITY_UNIT_VALUES = [
  { key: 'capacityLiters', value: 'liters' },
  { key: 'capacityGallons', value: 'gallons' },
  { key: 'capacityCubicFeet', value: 'cubic_feet' },
  { key: 'capacityCubicMeters', value: 'cubic_meters' },
  { key: 'capacityItems', value: 'items' },
];

const buildCapacityUnitOptions = (t: TFn) =>
  CAPACITY_UNIT_VALUES.map(opt => ({
    label: t(`storageLocationForm.${opt.key}`),
    value: opt.value,
  }));

interface StorageLocationFormProps {
  initialData?: any;
  onSubmit: (data: any) => void;
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
    const [advancedExpanded, setAdvancedExpanded] = useState(false);
    const chevronRotation = useSharedValue(0);

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

    useLayoutEffect(() => {
      chevronRotation.set(
        withSpring(advancedExpanded ? 180 : 0, SPRING.EXPAND),
      );
    }, [advancedExpanded, chevronRotation]);

    const animatedChevronStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${chevronRotation.get()}deg` }],
    }));

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
        <Pressable
          style={({ pressed }) => [
            styles.advancedHeader,
            pressed && styles.pressed,
          ]}
          onPress={() => setAdvancedExpanded(!advancedExpanded)}
        >
          <Text size="sm" weight="semibold" tone="secondary">
            {t('storageLocationForm.advancedSettings')}
          </Text>
          <Animated.View style={animatedChevronStyle}>
            <Icon name="chevron-down" size={20} tone="textSecondary" />
          </Animated.View>
        </Pressable>

        {advancedExpanded ? (
          <Animated.View
            entering={FadeIn.duration(TIMING.STANDARD)}
            exiting={FadeOut.duration(TIMING.FAST)}
          >
            <FormCheckbox
              label={t('storageLocationForm.climateControlled')}
              checked={formData.isClimateControlled}
              onPress={() =>
                setFormData({
                  ...formData,
                  isClimateControlled: !formData.isClimateControlled,
                })
              }
            />

            <View style={styles.capacityRow}>
              <FormNumberInput
                label={t('storageLocationForm.capacity')}
                value={formData.capacity}
                onChangeText={capacity =>
                  setFormData({ ...formData, capacity })
                }
                placeholder={t('storageLocationForm.capacityPlaceholder')}
                keyboardType="decimal-pad"
                containerStyle={styles.capacityInput}
              />
              <FormSelect
                label={t('storageLocationForm.unit')}
                value={formData.capacityUnit}
                onValueChange={capacityUnit =>
                  setFormData({ ...formData, capacityUnit })
                }
                options={buildCapacityUnitOptions(t)}
                placeholder={t('storageLocationForm.unitPlaceholder')}
                containerStyle={styles.capacityUnit}
              />
            </View>

            <FormCheckbox
              label={t('storageLocationForm.setAsDefault')}
              checked={formData.isDefault}
              onPress={() =>
                setFormData({ ...formData, isDefault: !formData.isDefault })
              }
            />
          </Animated.View>
        ) : null}

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
  advancedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  capacityRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-end',
  },
  capacityInput: {
    flex: 1,
  },
  capacityUnit: {
    flex: 1,
  },
  formActions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
