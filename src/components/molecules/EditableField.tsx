import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { WhiteActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormInput } from './FormInput';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { Text } from '#components/atoms/Text';

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
  const { t } = useTranslation();
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
        setError(
          err instanceof Error ? err.message : t('editableField.saveFailed'),
        );
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
          <AppPressable
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={saving}
          >
            <Text weight="semibold" tone="secondary">
              {t('labels.cancel')}
            </Text>
          </AppPressable>
          <AppPressable
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <WhiteActivityIndicator size="small" />
            ) : (
              <Text weight="semibold" style={styles.saveButtonText}>
                {t('labels.save')}
              </Text>
            )}
          </AppPressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.nameRow}>
      <View style={styles.nameContainer}>
        <Text size="sm" tone="secondary" style={styles.nameLabel}>
          {label}
        </Text>
        <Text size="lg" weight="semibold">
          {value}
        </Text>
      </View>
      {!readOnly && (
        <AppPressable style={styles.editIconButton} onPress={handleStartEdit}>
          <Icon name="create-outline" size={20} />
        </AppPressable>
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
    marginBottom: theme.spacing.xs,
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
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  saveButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    color: theme.colors.neutral[0],
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
