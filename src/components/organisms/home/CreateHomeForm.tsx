import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

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
          onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.createButton]}
          onPress={onSubmit}
          disabled={isCreating}>
          {isCreating ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.createButtonText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  createForm: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  formActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: theme.colors.primary,
  },
  createButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: theme.colors.textPrimary,
    backgroundColor: 'white',
  },
}));
