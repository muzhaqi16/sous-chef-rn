import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AnimatedButton } from '#/components/atoms/AnimatedButton';

interface CreateHomeFormProps {
  isVisible: boolean;
  homeName: string;
  onHomeNameChange: (name: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isCreating: boolean;
}

export const CreateHomeForm: React.FC<CreateHomeFormProps> = ({
  isVisible,
  homeName,
  onHomeNameChange,
  onSubmit,
  onCancel,
  isCreating,
}) => {
  if (!isVisible) return null;

  return (
    <View style={styles.createForm}>
      <TextInput
        style={styles.input}
        value={homeName}
        onChangeText={onHomeNameChange}
        placeholder="Enter home name"
        autoFocus
      />
      <View style={styles.formActions}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <AnimatedButton
          loading={isCreating}
          disabled={!homeName.trim()}
          onPress={onSubmit}
          variant="primary"
          style={styles.button}
        >
          Create
        </AnimatedButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  createForm: {
    backgroundColor: theme.colors.surface,
  },
  formActions: {
    flexDirection: 'row',
    marginTop: theme.spacing['3'],
    gap: theme.spacing['3'],
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing['3'] + 2,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: theme.colors.primary,
  },
  createButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
}));
