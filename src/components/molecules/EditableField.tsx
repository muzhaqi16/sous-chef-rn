import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormInput } from './FormInput';

interface EditableFieldProps {
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  validation?: (value: string) => string | null;
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
}) => {
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

  const handleSave = async () => {
    // Validate if validation function provided
    if (validation) {
      const validationError = validation(editValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(editValue);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
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
            style={({pressed}) => [styles.editButton, styles.cancelButton, pressed && styles.pressed]}
            onPress={handleCancel}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={({pressed}) => [styles.editButton, styles.saveButton, pressed && styles.pressed]}
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
      <Pressable style={({pressed}) => [styles.editIconButton, pressed && styles.pressed]} onPress={handleStartEdit}>
        <Icon name="edit" size={20} />
      </Pressable>
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
  editButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: theme.fonts.weight.semibold,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    color: theme.colors.neutral[0],
    fontWeight: theme.fonts.weight.semibold,
  },
  pressed: {
    opacity: 0.7,
  },
}));
