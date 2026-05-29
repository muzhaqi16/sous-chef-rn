import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface RecipeInstructionsProps {
  isBackendRecipe: boolean;
  instructions: unknown;
  instructionsHtml?: string;
}

// The two instruction shapes this component renders:
// - Backend / user-created flat steps: { step, text } or { number, step }
// - Spoonacular "analyzed instructions": [{ steps: [{ number, step }] }]
type DisplayStep = { step?: number | string; text?: string; number?: number };
type AnalyzedInstruction = {
  steps: Array<{ number: number; step: string }>;
};

const Step: React.FC<{ num: number | string; text: string }> = ({
  num,
  text,
}) => (
  <View style={styles.instructionStep}>
    <Text style={styles.stepNumber}>{num}.</Text>
    <Text style={styles.stepText}>{text}</Text>
  </View>
);

const parseHtmlSteps = (html: string): string[] =>
  html
    .replace(/<li[^>]*>/gi, '\n<STEP>')
    .replace(/<\/li>/gi, '')
    .replace(/<[^>]*>/g, '\n')
    .split('\n')
    .map(s => s.replace('<STEP>', '').trim())
    .filter(s => s.length > 0);

export const RecipeInstructions: React.FC<RecipeInstructionsProps> = ({
  isBackendRecipe,
  instructions,
  instructionsHtml,
}) => {
  const hasBackendInstructions =
    isBackendRecipe && Array.isArray(instructions) && instructions.length > 0;
  const hasAnalyzedInstructions =
    !isBackendRecipe &&
    Array.isArray(instructions) &&
    instructions.length > 0 &&
    ((instructions[0] as AnalyzedInstruction | undefined)?.steps?.length ?? 0) >
      0;
  const hasHtmlInstructions =
    !isBackendRecipe &&
    !!instructionsHtml &&
    typeof instructionsHtml === 'string';

  if (
    !hasBackendInstructions &&
    !hasAnalyzedInstructions &&
    !hasHtmlInstructions
  ) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Instructions</Text>
      {!!hasBackendInstructions &&
        (instructions as DisplayStep[]).map((step, index) => {
          // Support both formats:
          // User-created: { step: number, text: string }
          // Preloaded external: { number: number, step: string }
          const stepText = step.text ?? String(step.step ?? '');
          const stepNum =
            step.text != null
              ? step.step ?? index + 1
              : step.number ?? index + 1;
          return <Step key={index} num={stepNum} text={stepText} />;
        })}
      {!!hasAnalyzedInstructions &&
        (instructions as AnalyzedInstruction[])[0].steps.map((step, index) => (
          <Step key={index} num={step.number} text={step.step} />
        ))}
      {!hasBackendInstructions &&
        !hasAnalyzedInstructions &&
        !!hasHtmlInstructions &&
        parseHtmlSteps(instructionsHtml!).map((step, index) => (
          <Step key={index} num={index + 1} text={step} />
        ))}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  instructionStep: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  stepNumber: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
    minWidth: 24,
  },
  stepText: {
    flex: 1,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
}));
