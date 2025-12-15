import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BaseInput } from '#/components/atoms/BaseInput/BaseInput';
import { Button } from '#/components/base/Button';
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
      <BaseInput
        value={homeName}
        onChangeText={onHomeNameChange}
        placeholder="Enter home name"
        autoFocus
        autoCapitalize="words"
      />
      <View style={styles.formActions}>
        <Button
          variant="secondary"
          onPress={onCancel}
          fullWidth
        >
          Cancel
        </Button>
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
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
  },
}));
