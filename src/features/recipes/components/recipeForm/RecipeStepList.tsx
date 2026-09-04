import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { StepFormState } from '#features/recipes/screens/RecipeForm/formState';
import { Text } from '#components/atoms/Text';
import { SectionHeader } from '#components/atoms/SectionHeader';

interface RecipeStepListProps {
  steps: StepFormState[];
  onEditStep: (step: StepFormState) => void;
  onRemoveStep: (id: string) => void;
  onAddStep: () => void;
  /** The section's own refusal — an empty list, or a blank entry in it. */
  error?: string;
}

export const RecipeStepList: React.FC<RecipeStepListProps> = ({
  steps,
  onEditStep,
  onRemoveStep,
  onAddStep,
  error,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <SectionHeader variant="title" style={styles.sectionTitle}>
        {t('recipes.instructionsCount', { count: steps.length })}
      </SectionHeader>
      {steps.map((step, index) => (
        <AppPressable
          key={step.id}
          onPress={() => onEditStep(step)}
          style={styles.stepRow}
        >
          <View style={styles.stepNumber}>
            <Text role="label" style={styles.stepNumberText}>
              {index + 1}
            </Text>
          </View>
          <Text style={styles.stepText} numberOfLines={2}>
            {step.instruction || t('recipes.tapToAddInstruction')}
          </Text>
          <Pressable
            onPress={() => onRemoveStep(step.id)}
            accessibilityLabel={t('a11y.removeNamed', {
              name: step.instruction,
            })}
            hitSlop={8}
            style={styles.removeButton}
          >
            <Icon name="close-circle" size={20} tone="error" />
          </Pressable>
        </AppPressable>
      ))}
      <AppPressable onPress={onAddStep} style={styles.addButton}>
        <Icon name="add-circle-outline" size={20} tone="primary" />
        <Text role="bodyStrong" tone="accent" style={styles.addText}>
          {t('recipes.addStep')}
        </Text>
      </AppPressable>
      {!!error && (
        <Text role="error" tone="error" style={styles.sectionError}>
          {error}
        </Text>
      )}
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
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    marginTop: theme.spacing.sm,
  },
  sectionError: {
    marginTop: theme.spacing.xs,
  },
  addText: {
    marginLeft: theme.spacing.sm,
  },
}));
