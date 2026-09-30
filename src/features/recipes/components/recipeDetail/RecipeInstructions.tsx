import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import { SectionHeader } from '#components/atoms/SectionHeader';

interface RecipeInstructionsProps {
  /** `[{ step, text }]`; a catalog recipe's groups arrive already flattened. */
  instructions: unknown;
}

type DisplayStep = { step?: number | string; text?: string; number?: number };

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
      {(instructions as DisplayStep[]).map((step, index) => {
        // `{ step, text }` is the stored shape; a recipe imported before the
        // API fetched its own carries `{ number, step }`.
        const stepText = step.text ?? String(step.step ?? '');
        const stepNum =
          step.text != null ? step.step ?? index + 1 : step.number ?? index + 1;
        return <Step key={index} num={stepNum} text={stepText} />;
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
