import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';

interface SheetFormHeaderProps {
  title: string;
  cancelLabel: string;
  saveLabel: string;
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  submitTestID?: string;
}

/**
 * Cancel / title / Save header for the in-sheet "details" form steps of the
 * morphing AddItemSheet. Shared by the pantry (`AddDetailsSheet`) and
 * shopping-list (`ShoppingListDetailsStep`) flows so the layout and the
 * disabled/saving styling stay identical. The caller computes `saveLabel`
 * (e.g. swapping in an "Adding…" label while `saving`).
 */
export const SheetFormHeader: React.FC<SheetFormHeaderProps> = ({
  title,
  cancelLabel,
  saveLabel,
  onCancel,
  onSave,
  saving = false,
  submitTestID,
}) => {
  return (
    <View style={styles.header}>
      <AppPressable onPress={onCancel} style={styles.cancelButton}>
        <Text size="md" weight="medium" tone="secondary">
          {cancelLabel}
        </Text>
      </AppPressable>
      <Text size="lg" weight="bold" align="center" style={styles.title}>
        {title}
      </Text>
      <AppPressable
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={saving}
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
  },
  saveButtonDisabled: {
    opacity: theme.opacity.disabled,
  },
  saveButtonText: {
    color: theme.colors.white,
  },
}));
