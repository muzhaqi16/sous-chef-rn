import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { Text } from '#components/atoms/Text';
import type { OnboardingSummary } from '#features/onboarding/hooks/useOnboardingSummary';

/** The summary's lines: the home first, then each step done here, in order. */
function summaryLines(summary: OnboardingSummary, t: Translate): string[] {
  const lines: string[] = [];
  if (summary.homeAndPantry && summary.shoppingList) {
    lines.push(t('onBoarding.summaryHomeReady'));
  } else if (summary.homeAndPantry) {
    lines.push(t('onBoarding.summaryHomeAndPantry'));
  } else if (summary.shoppingList) {
    lines.push(t('onBoarding.summaryShoppingList'));
  }
  if (summary.cooksFor !== null) {
    lines.push(t('onBoarding.summaryCooksFor', { count: summary.cooksFor }));
  }
  if (summary.dietarySaved) lines.push(t('onBoarding.summaryDietarySaved'));
  if (summary.receiptItems > 0) {
    lines.push(
      t('onBoarding.summaryReceiptItems', { count: summary.receiptItems }),
    );
  }
  if (summary.stapleItems > 0) {
    lines.push(
      t('onBoarding.summaryStapleItems', { count: summary.stapleItems }),
    );
  }
  return lines;
}

/** What onboarding set up, never claiming a step that was skipped. */
export const SetupSummary = ({ summary }: { summary: OnboardingSummary }) => {
  const { t } = useTranslation();
  const lines = summaryLines(summary, t);

  if (lines.length === 0) {
    return (
      <Text role="body" align="center" style={styles.heading}>
        {t('onBoarding.nothingSetUp')}
      </Text>
    );
  }
  return (
    <>
      <Text role="bodyStrong" align="center" style={styles.heading}>
        {t('onBoarding.summaryLead')}
      </Text>
      <View style={styles.list}>
        {lines.map(line => (
          <Text key={line} role="body" tone="secondary" style={styles.line}>
            {`• ${line}`}
          </Text>
        ))}
      </View>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  heading: {
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  list: {
    marginBottom: theme.spacing.xl,
  },
  line: {
    marginBottom: theme.spacing.sm,
  },
}));
