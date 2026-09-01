import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';

interface SheetFormHeaderProps {
  title: string;
  cancelLabel: string;
  /** Defaults to the submit id with `-submit-button` swapped for `-cancel-button`. */
  cancelTestID?: string;
  saveLabel: string;
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  /**
   * The form is incomplete — distinct from `saving`, a submission in flight. Both
   * dim and disable; only `saving` cues the caller to swap in a progress label.
   */
  disabled?: boolean;
  submitTestID?: string;
}

/**
 * Cancel / title / Save header for the AddItemSheet details steps, shared by the
 * pantry and shopping-list flows so the disabled/saving styling cannot drift.
 */
export const SheetFormHeader: React.FC<SheetFormHeaderProps> = ({
  title,
  cancelLabel,
  saveLabel,
  onCancel,
  onSave,
  saving = false,
  disabled = false,
  submitTestID,
  cancelTestID,
}) => {
  // Not a default parameter: a ternary in one bails the React Compiler out of the
  // whole component ("ConditionalExpression cannot be safely reordered").
  const resolvedCancelTestID =
    cancelTestID ??
    (submitTestID
      ? `${submitTestID.replace(/-submit-button$/, '')}-cancel-button`
      : undefined);

  return (
    <View style={styles.header}>
      <AppPressable
        onPress={onCancel}
        // The only way to dismiss these sheets.
        testID={resolvedCancelTestID}
        style={styles.cancelButton}
      >
        <Text size="md" weight="medium" tone="secondary">
          {cancelLabel}
        </Text>
      </AppPressable>
      <Text size="lg" weight="bold" align="center" style={styles.title}>
        {title}
      </Text>
      <AppPressable
        style={[
          styles.saveButton,
          (saving || disabled) && styles.saveButtonDisabled,
        ]}
        onPress={onSave}
        disabled={saving || disabled}
        testID={submitTestID}
      >
        <Text size="md" weight="semibold" style={styles.saveButtonText}>
          {saveLabel}
        </Text>
      </AppPressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  cancelButton: {
    minWidth: 60,
  },
  title: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  saveButtonDisabled: {
    opacity: theme.opacity.disabled,
  },
  saveButtonText: {
    color: theme.colors.onPrimary,
  },
}));
