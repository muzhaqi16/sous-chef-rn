import React, { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormInput } from './FormInput';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

interface EditableFieldProps {
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  validation?: (value: string) => string | null;
  readOnly?: boolean;
}

/**
 * EditableField - A reusable component for inline editing
 * Handles both display and edit modes with save/cancel actions
 */
export const EditableField: React.FC<EditableFieldProps> = ({
  label,
  value,
  onSave,
  placeholder,
  validation,
  readOnly,
}) => {
  const { theme } = useUnistyles();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartEdit = () => {
    setEditValue(value);
    setError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditValue(value);
    setError(null);
    setEditing(false);
  };

  const handleSave = () => {
    // Validate if validation function provided
    if (validation) {
      const validationError = validation(editValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setError(null);

    executeWithLoadingState(
      async () => {
        await onSave(editValue);
        setEditing(false);
      },
      setSaving,
      err => {
        setError(err instanceof Error ? err.message : 'Failed to save');
      },
    );
  };

  if (editing) {
    return (
      <View>
        <FormInput
          label={label}
          value={editValue}
          onChangeText={setEditValue}
          placeholder={placeholder}
          autoFocus
          error={error ?? undefined}
        />
        <View style={styles.editActions}>
          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && { opacity: theme.opacity.pressed },
            ]}
            onPress={handleCancel}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && { opacity: theme.opacity.pressed },
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.nameRow}>
      <View style={styles.nameContainer}>
        <Text style={styles.nameLabel}>{label}</Text>
        <Text style={styles.nameValue}>{value}</Text>
      </View>
      {!readOnly && (
        <Pressable
          style={({ pressed }) => [
            styles.editIconButton,
            pressed && { opacity: theme.opacity.pressed },
          ]}
          onPress={handleStartEdit}
        >
          <Icon name="create-outline" size={20} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  nameContainer: {
    flex: 1,
  },
  nameLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  nameValue: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  editIconButton: {
    padding: theme.spacing.sm,
  },
  editActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: theme.fonts.weight.semibold,
  },
  saveButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    color: theme.colors.neutral[0],
    fontWeight: theme.fonts.weight.semibold,
  },
}));
