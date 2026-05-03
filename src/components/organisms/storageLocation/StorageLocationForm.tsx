import React, {
  useState,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { View, TextInput, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Pressable, ScrollView } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { StorageState } from '#generated';
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

const STORAGE_TYPES = [
  { label: 'Refrigerator', value: 'REFRIGERATOR' },
  { label: 'Freezer', value: 'FREEZER' },
  { label: 'Pantry Shelf', value: 'PANTRY_SHELF' },
  { label: 'Cabinet', value: 'CABINET' },
  { label: 'Drawer', value: 'DRAWER' },
  { label: 'Counter', value: 'COUNTER' },
  { label: 'Basement', value: 'BASEMENT' },
  { label: 'Garage', value: 'GARAGE' },
  { label: 'Closet', value: 'CLOSET' },
  { label: 'Outdoor', value: 'OUTDOOR' },
  { label: 'Boat Storage', value: 'BOAT_STORAGE' },
  { label: 'RV Storage', value: 'RV_STORAGE' },
  { label: 'Custom', value: 'CUSTOM' },
];

const TEMPERATURE_OPTIONS: Array<{ label: string; value: StorageState }> = [
  { label: 'None', value: StorageState.None },
  { label: 'Ambient', value: StorageState.Ambient },
  { label: 'Refrigerated', value: StorageState.Refrigerated },
  { label: 'Frozen', value: StorageState.Frozen },
];

const COLOR_PRESETS = [
  { label: 'Red', value: '#E53935' },
  { label: 'Pink', value: '#D81B60' },
  { label: 'Purple', value: '#8E24AA' },
  { label: 'Blue', value: '#1E88E5' },
  { label: 'Teal', value: '#00897B' },
  { label: 'Green', value: '#43A047' },
  { label: 'Orange', value: '#FB8C00' },
  { label: 'Brown', value: '#6D4C41' },
  { label: 'Grey', value: '#757575' },
  { label: 'Indigo', value: '#3949AB' },
];

const CAPACITY_UNIT_OPTIONS = [
  { label: 'Liters', value: 'liters' },
  { label: 'Gallons', value: 'gallons' },
  { label: 'Cubic Feet', value: 'cubic_feet' },
  { label: 'Cubic Meters', value: 'cubic_meters' },
  { label: 'Items', value: 'items' },
];

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
    const { theme } = useUnistyles();
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
          <Text style={commonStyles.label}>Name</Text>
          <TextInput
            style={commonStyles.input}
            value={formData.name}
            onChangeText={name => setFormData({ ...formData, name })}
            placeholder="e.g., Main Refrigerator"
            autoFocus
          />
        </View>

        {/* Type Carousel */}
        <View style={[commonStyles.inputGroup, styles.carouselInputGroup]}>
          <Text style={commonStyles.label}>Type</Text>
          <View style={styles.carouselContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.typeScroll}
              contentContainerStyle={styles.typeScrollContent}
            >
              {STORAGE_TYPES.map(type => (
                <Pressable
                  key={type.value}
                  style={({ pressed }) => [
                    formData.type === type.value
                      ? styles.typeButtonSelected
                      : styles.typeButton,
                    pressed && { opacity: theme.opacity.pressed },
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
                    {type.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Parent Location Selector */}
        {parentOptions.length > 0 && (
          <View style={[commonStyles.inputGroup, styles.carouselInputGroup]}>
            <Text style={commonStyles.label}>Parent Location (Optional)</Text>
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
                    pressed && { opacity: theme.opacity.pressed },
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
                    None
                  </Text>
                </Pressable>
                {parentOptions.map(location => (
                  <Pressable
                    key={location.id}
                    style={({ pressed }) => [
                      formData.parentLocationId === location.id
                        ? styles.parentButtonSelected
                        : styles.parentButton,
                      pressed && { opacity: theme.opacity.pressed },
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
              Organize locations hierarchically (e.g., drawer inside fridge)
            </Text>
          </View>
        )}

        {/* Description */}
        <FormTextArea
          label="Description (Optional)"
          value={formData.description}
          onChangeText={description =>
            setFormData({ ...formData, description })
          }
          placeholder="Notes about this location..."
          numberOfLines={2}
        />

        {/* Temperature */}
        <View style={[commonStyles.inputGroup, styles.carouselInputGroup]}>
          <Text style={commonStyles.label}>Temperature</Text>
          <View style={styles.carouselContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.typeScroll}
              contentContainerStyle={styles.typeScrollContent}
            >
              {TEMPERATURE_OPTIONS.map(option => (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    formData.temperature === option.value
                      ? styles.parentButtonSelected
                      : styles.parentButton,
                    pressed && { opacity: theme.opacity.pressed },
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
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Color */}
        <View style={[commonStyles.inputGroup, styles.carouselInputGroup]}>
          <Text style={commonStyles.label}>Color (Optional)</Text>
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
                  pressed && { opacity: theme.opacity.pressed },
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
                    pressed && { opacity: theme.opacity.pressed },
                  ]}
                  onPress={() =>
                    setFormData({ ...formData, color: preset.value })
                  }
                  accessibilityLabel={preset.label}
                />
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Advanced Settings Collapsible */}
        <Pressable
          style={({ pressed }) => [
            styles.advancedHeader,
            pressed && { opacity: theme.opacity.pressed },
          ]}
          onPress={() => setAdvancedExpanded(!advancedExpanded)}
        >
          <Text size="sm" weight="semibold" tone="secondary">
            Advanced Settings
          </Text>
          <Animated.View style={animatedChevronStyle}>
            <Icon
              name="chevron-down"
              size={20}
              color={theme.colors.textSecondary}
            />
          </Animated.View>
        </Pressable>

        {advancedExpanded ? (
          <Animated.View
            entering={FadeIn.duration(TIMING.STANDARD)}
            exiting={FadeOut.duration(TIMING.FAST)}
          >
            <FormCheckbox
              label="Climate Controlled"
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
                label="Capacity"
                value={formData.capacity}
                onChangeText={capacity =>
                  setFormData({ ...formData, capacity })
                }
                placeholder="e.g., 100"
                keyboardType="decimal-pad"
                containerStyle={styles.capacityInput}
              />
              <FormSelect
                label="Unit"
                value={formData.capacityUnit}
                onValueChange={capacityUnit =>
                  setFormData({ ...formData, capacityUnit })
                }
                options={CAPACITY_UNIT_OPTIONS}
                placeholder="Select unit"
                containerStyle={styles.capacityUnit}
              />
            </View>

            <FormCheckbox
              label="Set as Default Location"
              checked={formData.isDefault}
              onPress={() =>
                setFormData({ ...formData, isDefault: !formData.isDefault })
              }
            />
          </Animated.View>
        ) : null}

        {!hideActions && (
          <View style={styles.formActions}>
            <Pressable
              style={({ pressed }) => [
                commonStyles.button,
                commonStyles.buttonSecondary,
                pressed && { opacity: theme.opacity.pressed },
              ]}
              onPress={onCancel}
              disabled={isSubmitting}
            >
              <Text style={commonStyles.buttonTextSecondary}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                commonStyles.button,
                commonStyles.buttonPrimary,
                pressed && { opacity: theme.opacity.pressed },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={commonStyles.buttonTextPrimary}>
                  {initialData ? 'Update' : 'Create'}
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
    ...commonStyles.row,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
}));
