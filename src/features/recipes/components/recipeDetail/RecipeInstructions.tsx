import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { isRecord } from '#/utils/isRecord';

interface RecipeInstructionsProps {
  /** `[{ step, text }]`; a catalog recipe's groups arrive already flattened. */
  instructions: unknown;
}

const stepLabel = (value: unknown, fallback: number): number | string =>
  typeof value === 'number' || typeof value === 'string' ? value : fallback;

/**
 * A step as the author or import source stored it: plain text, `{ step, text }`,
 * or `{ number, step }` from a recipe imported before the API fetched its own.
 */
function displayStep(
  step: unknown,
  index: number,
): { num: number | string; text: string } {
  if (typeof step === 'string') return { num: index + 1, text: step };
  if (!isRecord(step)) return { num: index + 1, text: '' };
  if (typeof step.text === 'string') {
    return { num: stepLabel(step.step, index + 1), text: step.text };
  }
  return {
    num: stepLabel(step.number, index + 1),
    text: typeof step.step === 'string' ? step.step : '',
  };
}

const Step: React.FC<{ num: number | string; text: string }> = ({
  num,
  text,
}) => (
  <View style={styles.instructionStep}>
    <Text role="bodyStrong" style={styles.stepNumber}>
      {num}.
    </Text>
    <Text role="body" style={styles.stepText}>
      {text}
    </Text>
  </View>
);

export const RecipeInstructions: React.FC<RecipeInstructionsProps> = ({
  instructions,
}) => {
  const { t } = useTranslation();
  if (!Array.isArray(instructions) || instructions.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader style={styles.sectionTitleSpacing}>
        {t('recipes.instructions')}
      </SectionHeader>
      {instructions.map((step: unknown, index) => {
        const { num, text } = displayStep(step, index);
        return <Step key={index} num={num} text={text} />;
      })}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    marginBottom: theme.spacing.xl,
  },
  instructionStep: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  stepNumber: {
    color: theme.colors.primary,
    minWidth: 24,
  },
  stepText: {
    flex: 1,
    color: theme.colors.textPrimary,
  },
  sectionTitleSpacing: {
    marginBottom: theme.spacing.sm,
  },
}));
