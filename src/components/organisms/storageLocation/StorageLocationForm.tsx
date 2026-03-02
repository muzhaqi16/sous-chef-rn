import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { ScrollView } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { StorageState } from '#generated';
import { FormTextArea } from '#components/molecules/FormTextArea';
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { FormNumberInput } from '#components/molecules/FormNumberInput';
import { FormSelect } from '#components/molecules/FormSelect';
import { Icon } from '#utils/iconUtils';
import { SPRING, TIMING } from '#/constants/animations';

export interface StorageLocationFormRef {
  submit: () => void;
  isValid: () => boolean;
}

const STORAGE_TYPES = [
  { label: 'Refrigerator', value: 'REFRIGERATOR', icon: '🧊' },
  { label: 'Freezer', value: 'FREEZER', icon: '❄️' },
  { label: 'Pantry Shelf', value: 'PANTRY_SHELF', icon: '🏺' },
  { label: 'Cabinet', value: 'CABINET', icon: '🗄️' },
  { label: 'Drawer', value: 'DRAWER', icon: '🗃️' },
  { label: 'Counter', value: 'COUNTER', icon: '🍴' },
  { label: 'Basement', value: 'BASEMENT', icon: '🏠' },
  { label: 'Garage', value: 'GARAGE', icon: '🚗' },
  { label: 'Closet', value: 'CLOSET', icon: '🚪' },
  { label: 'Outdoor', value: 'OUTDOOR', icon: '🌳' },
  { label: 'Boat Storage', value: 'BOAT_STORAGE', icon: '⛵' },
  { label: 'RV Storage', value: 'RV_STORAGE', icon: '🚐' },
  { label: 'Custom', value: 'CUSTOM', icon: '📦' },
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

export const StorageLocationForm = forwardRef<StorageLocationFormRef, StorageLocationFormProps>(({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  availableLocations = [],
  hideActions = false,
}, ref) => {
  const { theme } = useUnistyles();
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const chevronRotation = useSharedValue(0);

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'PANTRY_SHELF',
    icon: initialData?.icon || '',
    parentLocationId: initialData?.parentLocationId || undefined,
    description: initialData?.description || '',
    temperature: initialData?.temperature || StorageState.None,
    color: initialData?.color || null as string | null,
    isClimateControlled: initialData?.isClimateControlled || false,
    capacity: initialData?.capacity != null ? String(initialData.capacity) : '',
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
        icon: initialData.icon || '',
        parentLocationId: initialData.parentLocationId || undefined,
        description: initialData.description || '',
        temperature: initialData.temperature || StorageState.None,
        color: initialData.color || null,
        isClimateControlled: initialData.isClimateControlled || false,
        capacity: initialData.capacity != null ? String(initialData.capacity) : '',
        capacityUnit: initialData.capacityUnit || '',
        isDefault: initialData.isDefault || false,
      });
    }
  }

  useEffect(() => {
    chevronRotation.set(withSpring(advancedExpanded ? 180 : 0, SPRING.EXPAND));
  }, [advancedExpanded, chevronRotation]);

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  // Filter out current location from parent options (can't be its own parent)
  const parentOptions = availableLocations.filter(
    loc => loc.id !== initialData?.id,
  );

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      return;
    }

    const capacityFloat = formData.capacity ? parseFloat(formData.capacity) : null;

    const finalData = {
      name: formData.name.trim(),
      type: formData.type,
      icon: formData.icon || null,
      parentLocationId: formData.parentLocationId || null,
      description: formData.description.trim() || null,
      temperature: formData.temperature !== StorageState.None ? formData.temperature : null,
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
      <View style={commonStyles.inputGroup}>
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
                style={({pressed}) => [
                  styles.typeButton,
                  formData.type === type.value && styles.typeButtonSelected,
                  pressed && styles.pressed,
                ]}
                onPress={() => setFormData({ ...formData, type: type.value, icon: type.icon })}
              >
                <Text style={styles.typeIcon}>{type.icon}</Text>
                <Text
                  style={[
                    styles.typeLabel,
                    formData.type === type.value && styles.typeLabelSelected,
                  ]}
                >
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View
            style={[
              styles.fadeLeft,
              { backgroundColor: theme.colors.surface },
            ]}
            pointerEvents="none"
          />
          <View
            style={[
              styles.fadeRight,
              { backgroundColor: theme.colors.surface },
            ]}
            pointerEvents="none"
          />
        </View>
      </View>

      {/* Icon */}
      <View style={commonStyles.inputGroup}>
        <Text style={commonStyles.label}>Icon (Optional)</Text>
        <TextInput
          style={commonStyles.input}
          value={formData.icon}
          onChangeText={icon => setFormData({ ...formData, icon })}
          placeholder="Enter emoji (e.g., 🧊)"
          maxLength={2}
        />
        <Text style={styles.hint}>
          Leave empty for no icon
        </Text>
      </View>

      {/* Parent Location Selector */}
      {parentOptions.length > 0 && (
        <View style={commonStyles.inputGroup}>
          <Text style={commonStyles.label}>Parent Location (Optional)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.parentScroll}
          >
            <Pressable
              style={({pressed}) => [
                styles.parentButton,
                !formData.parentLocationId && styles.parentButtonSelected,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                setFormData({ ...formData, parentLocationId: undefined })
              }
            >
              <Text
                style={[
                  styles.parentLabel,
                  !formData.parentLocationId && styles.parentLabelSelected,
                ]}
              >
                None
              </Text>
            </Pressable>
            {parentOptions.map(location => (
              <Pressable
                key={location.id}
                style={({pressed}) => [
                  styles.parentButton,
                  formData.parentLocationId === location.id &&
                    styles.parentButtonSelected,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  setFormData({ ...formData, parentLocationId: location.id })
                }
              >
                <Text
                  style={[
                    styles.parentLabel,
                    formData.parentLocationId === location.id &&
                      styles.parentLabelSelected,
                  ]}
                >
                  {location.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.hint}>
            Organize locations hierarchically (e.g., drawer inside fridge)
          </Text>
        </View>
      )}

      {/* Description */}
      <FormTextArea
        label="Description (Optional)"
        value={formData.description}
        onChangeText={description => setFormData({ ...formData, description })}
        placeholder="Notes about this location..."
        numberOfLines={2}
      />

      {/* Temperature */}
      <View style={commonStyles.inputGroup}>
        <Text style={commonStyles.label}>Temperature</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.parentScroll}
        >
          {TEMPERATURE_OPTIONS.map(option => (
            <Pressable
              key={option.value}
              style={({pressed}) => [
                styles.parentButton,
                formData.temperature === option.value && styles.parentButtonSelected,
                pressed && styles.pressed,
              ]}
              onPress={() => setFormData({ ...formData, temperature: option.value })}
            >
              <Text
                style={[
                  styles.parentLabel,
                  formData.temperature === option.value && styles.parentLabelSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Color */}
      <View style={commonStyles.inputGroup}>
        <Text style={commonStyles.label}>Color (Optional)</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.colorScroll}
        >
          <Pressable
            style={({pressed}) => [
              styles.colorSwatch,
              styles.colorSwatchNone,
              !formData.color && styles.colorSwatchSelected,
              pressed && styles.pressed,
            ]}
            onPress={() => setFormData({ ...formData, color: null })}
          >
            <Text style={styles.colorNoneText}>-</Text>
          </Pressable>
          {COLOR_PRESETS.map(preset => (
            <Pressable
              key={preset.value}
              style={({pressed}) => [
                styles.colorSwatch,
                { backgroundColor: preset.value },
                formData.color === preset.value && styles.colorSwatchSelected,
                pressed && styles.pressed,
              ]}
              onPress={() => setFormData({ ...formData, color: preset.value })}
              accessibilityLabel={preset.label}
            />
          ))}
        </ScrollView>
      </View>

      {/* Advanced Settings Collapsible */}
      <Pressable
        style={({pressed}) => [styles.advancedHeader, pressed && styles.pressed]}
        onPress={() => setAdvancedExpanded(!advancedExpanded)}
      >
        <Text style={styles.advancedHeaderText}>Advanced Settings</Text>
        <Animated.View style={animatedChevronStyle}>
          <Icon name="chevron-down" size={20} color={theme.colors.textSecondary} />
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
            onPress={() => setFormData({ ...formData, isClimateControlled: !formData.isClimateControlled })}
          />

          <View style={styles.capacityRow}>
            <FormNumberInput
              label="Capacity"
              value={formData.capacity}
              onChangeText={capacity => setFormData({ ...formData, capacity })}
              placeholder="e.g., 100"
              keyboardType="decimal-pad"
              containerStyle={styles.capacityInput}
            />
            <FormSelect
              label="Unit"
              value={formData.capacityUnit}
              onValueChange={capacityUnit => setFormData({ ...formData, capacityUnit })}
              options={CAPACITY_UNIT_OPTIONS}
              placeholder="Select unit"
              containerStyle={styles.capacityUnit}
            />
          </View>

          <FormCheckbox
            label="Set as Default Location"
            checked={formData.isDefault}
            onPress={() => setFormData({ ...formData, isDefault: !formData.isDefault })}
          />
        </Animated.View>
      ) : null}

      {!hideActions && (
        <View style={styles.formActions}>
          <Pressable
            style={({pressed}) => [commonStyles.button, commonStyles.buttonSecondary, pressed && styles.pressed]}
            onPress={onCancel}
            disabled={isSubmitting}
          >
            <Text style={commonStyles.buttonTextSecondary}>Cancel</Text>
          </Pressable>
          <Pressable
            style={({pressed}) => [commonStyles.button, commonStyles.buttonPrimary, pressed && styles.pressed]}
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
});

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
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
  fadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 24,
    backgroundColor: theme.colors.background,
    opacity: 0.9,
  },
  fadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 24,
    backgroundColor: theme.colors.background,
    opacity: 0.9,
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
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  parentButtonSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  typeIcon: {
    fontSize: theme.typography.fontSize.xl,
    marginBottom: theme.spacing.xs,
  },
  typeLabel: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.fonts.weight.medium,
  },
  typeLabelSelected: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
  parentLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fonts.weight.medium,
  },
  parentLabelSelected: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
  hint: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  colorScroll: {
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
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: theme.colors.textPrimary,
  },
  colorNoneText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fonts.weight.medium,
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
  advancedHeaderText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
