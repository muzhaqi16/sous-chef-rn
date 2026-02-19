import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { StepFormState } from '../useRecipeForm';

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
      <Text style={styles.sectionTitle}>
        Instructions ({steps.length})
      </Text>

      {steps.map((step, index) => (
        <Pressable
          key={step.id}
          onPress={() => onEditStep(step)}
          style={({ pressed }) => [styles.stepRow, pressed && styles.pressed]}
        >
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{index + 1}</Text>
          </View>
          <Text style={styles.stepText} numberOfLines={2}>
            {step.instruction || 'Tap to add instruction...'}
          </Text>
          <Pressable
            onPress={() => onRemoveStep(step.id)}
            hitSlop={8}
            style={styles.removeButton}
          >
            <Icon library="Ionicons" name="close-circle" size={20} color={styles.removeIcon.color} />
          </Pressable>
        </Pressable>
      ))}

      <Pressable
        onPress={onAddStep}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
      >
        <Icon library="Ionicons" name="add-circle-outline" size={20} color={styles.addIcon.color} />
        <Text style={styles.addText}>Add Step</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
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
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.white,
  },
  stepText: {
    flex: 1,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
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
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.primary,
  },
}));
