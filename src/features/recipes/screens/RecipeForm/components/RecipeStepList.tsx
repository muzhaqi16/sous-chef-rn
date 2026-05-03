import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { StepFormState } from '../useRecipeForm';
import { Text } from '#components/atoms/Text';

interface RecipeStepListProps {
  steps: StepFormState[];
  onEditStep: (step: StepFormState) => void;
  onRemoveStep: (id: string) => void;
  onAddStep: () => void;
}

export const RecipeStepList: React.FC<RecipeStepListProps> = ({
  steps,
  onEditStep,
  onRemoveStep,
  onAddStep,
}) => {
  return (
    <View style={styles.container}>
      <Text size="lg" weight="semibold" style={styles.sectionTitle}>
        Instructions ({steps.length})
      </Text>

      {steps.map((step, index) => (
        <Pressable
          key={step.id}
          onPress={() => onEditStep(step)}
          style={({ pressed }) => [styles.stepRow, pressed && styles.pressed]}
        >
          <View style={styles.stepNumber}>
            <Text size="sm" weight="bold" style={styles.stepNumberText}>
              {index + 1}
            </Text>
          </View>
          <Text size="md" style={styles.stepText} numberOfLines={2}>
            {step.instruction || 'Tap to add instruction...'}
          </Text>
          <Pressable
            onPress={() => onRemoveStep(step.id)}
            hitSlop={8}
            style={styles.removeButton}
          >
            <Icon
              name="close-circle"
              size={20}
              color={styles.removeIcon.color}
            />
          </Pressable>
        </Pressable>
      ))}

      <Pressable
        onPress={onAddStep}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
      >
        <Icon
          name="add-circle-outline"
          size={20}
          color={styles.addIcon.color}
        />
        <Text size="md" weight="medium" tone="accent" style={styles.addText}>
          Add Step
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  stepNumberText: {
    color: theme.colors.white,
  },
  stepText: {
    flex: 1,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  removeIcon: {
    color: theme.colors.error,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    marginTop: theme.spacing.sm,
  },
  addIcon: {
    color: theme.colors.primary,
  },
  addText: {
    marginLeft: theme.spacing.sm,
  },
}));
