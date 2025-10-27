import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#styles';

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
}

export const StorageLocationForm: React.FC<StorageLocationFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  availableLocations = [],
}) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'PANTRY_SHELF',
    icon: initialData?.icon || '',
    parentLocationId: initialData?.parentLocationId || undefined,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        type: initialData.type || 'PANTRY_SHELF',
        icon: initialData.icon || '',
        parentLocationId: initialData.parentLocationId || undefined,
      });
    }
  }, [initialData]);

  // Filter out current location from parent options (can't be its own parent)
  const parentOptions = availableLocations.filter(
    loc => loc.id !== initialData?.id
  );

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      return;
    }

    // Auto-set icon if not provided
    const finalData = {
      ...formData,
      name: formData.name.trim(),
      icon:
        formData.icon ||
        STORAGE_TYPES.find(t => t.value === formData.type)?.icon ||
        '📦',
    };

    onSubmit(finalData);
  };

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.typeScroll}
        >
          {STORAGE_TYPES.map(type => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.typeButton,
                formData.type === type.value && styles.typeButtonSelected,
              ]}
              onPress={() => setFormData({ ...formData, type: type.value })}
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
            </TouchableOpacity>
          ))}
        </ScrollView>
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
          Leave empty to use default icon for selected type
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
            <TouchableOpacity
              style={[
                styles.parentButton,
                !formData.parentLocationId && styles.parentButtonSelected,
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
            </TouchableOpacity>
            {parentOptions.map(location => (
              <TouchableOpacity
                key={location.id}
                style={[
                  styles.parentButton,
                  formData.parentLocationId === location.id &&
                    styles.parentButtonSelected,
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
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.hint}>
            Organize locations hierarchically (e.g., drawer inside fridge)
          </Text>
        </View>
      )}

      <View style={styles.formActions}>
        <TouchableOpacity
          style={[commonStyles.button, commonStyles.buttonSecondary]}
          onPress={onCancel}
          disabled={isSubmitting}
        >
          <Text style={commonStyles.buttonTextSecondary}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[commonStyles.button, commonStyles.buttonPrimary]}
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
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.md,
  },
  typeScroll: {
    marginTop: theme.spacing.xs,
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
    backgroundColor: theme.colors.surface,
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
    fontSize: 24,
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
}));
