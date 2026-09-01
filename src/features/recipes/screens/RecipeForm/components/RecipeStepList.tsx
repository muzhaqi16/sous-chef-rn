import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
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
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text size="lg" weight="semibold" style={styles.sectionTitle}>
        {t('recipes.instructionsCount', { count: steps.length })}
      </Text>
      {steps.map((step, index) => (
        <AppPressable
          key={step.id}
          onPress={() => onEditStep(step)}
          style={styles.stepRow}
        >
          <View style={styles.stepNumber}>
            <Text size="sm" weight="bold" style={styles.stepNumberText}>
              {index + 1}
            </Text>
          </View>
          <Text size="md" style={styles.stepText} numberOfLines={2}>
            {step.instruction || t('recipes.tapToAddInstruction')}
          </Text>
          <Pressable
            onPress={() => onRemoveStep(step.id)}
            hitSlop={8}
            style={styles.removeButton}
          >
            <Icon name="close-circle" size={20} tone="error" />
          </Pressable>
        </AppPressable>
      ))}
      <AppPressable onPress={onAddStep} style={styles.addButton}>
        <Icon name="add-circle-outline" size={20} tone="primary" />
        <Text size="md" weight="medium" tone="accent" style={styles.addText}>
          {t('recipes.addStep')}
        </Text>
      </AppPressable>
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
    borderCurve: 'continuous',
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
    color: theme.colors.onPrimary,
  },
  stepText: {
    flex: 1,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    marginTop: theme.spacing.sm,
  },
  addText: {
    marginLeft: theme.spacing.sm,
  },
}));
