import React, { useState, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';

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
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'PANTRY_SHELF',
    icon: initialData?.icon || '',
    parentLocationId: initialData?.parentLocationId || undefined,
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

    // Only include icon if user explicitly set one, allow clearing in edit mode
    const finalData = {
      ...formData,
      name: formData.name.trim(),
      icon: formData.icon || null,
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
  formActions: {
    ...commonStyles.row,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
