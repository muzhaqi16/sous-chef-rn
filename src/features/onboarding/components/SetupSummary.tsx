import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#components/atoms/Icon';
import { Reveal } from '#components/atoms/Reveal';
import { Text } from '#components/atoms/Text';
import { COOKS_FOR_MAX } from '#domain/servings';
import type { OnboardingSummary } from '#features/onboarding/hooks/useOnboardingSummary';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { PeopleStepper } from './PeopleStepper';

type LineKind = 'home' | 'household' | 'dietary' | 'receipt' | 'staples';

/** The summary's lines: the home first, then each step done here, in order. */
function summaryLines(
  summary: OnboardingSummary,
  t: Translate,
): { kind: LineKind; text: string }[] {
  const lines: { kind: LineKind; text: string }[] = [];
  if (summary.homeAndPantry && summary.shoppingList) {
    lines.push({ kind: 'home', text: t('onBoarding.summaryHomeReady') });
  } else if (summary.homeAndPantry) {
    lines.push({ kind: 'home', text: t('onBoarding.summaryHomeAndPantry') });
  } else if (summary.shoppingList) {
    lines.push({ kind: 'home', text: t('onBoarding.summaryShoppingList') });
  }
  if (summary.cooksFor !== null) {
    lines.push({
      kind: 'household',
      text: t('onBoarding.summaryCooksFor', { count: summary.cooksFor }),
    });
  }
  if (summary.dietarySaved) {
    lines.push({ kind: 'dietary', text: t('onBoarding.summaryDietarySaved') });
  }
  if (summary.receiptItems > 0) {
    lines.push({
      kind: 'receipt',
      text: t('onBoarding.summaryReceiptItems', {
        count: summary.receiptItems,
      }),
    });
  }
  if (summary.stapleItems > 0) {
    lines.push({
      kind: 'staples',
      text: t('onBoarding.summaryStapleItems', { count: summary.stapleItems }),
    });
  }
  return lines;
}

interface SetupSummaryProps {
  summary: OnboardingSummary;
  /** A new count of people, saved where the household step saves it. */
  onChangeCooksFor: (count: number) => void;
  /** Opens the dietary step, which returns here once saved. */
  onChangeDietary: () => void;
}

/**
 * What onboarding set up, never claiming a step that was skipped. A tap on
 * who the meals are for, or on the dietary needs, opens that answer again.
 */
export const SetupSummary = ({
  summary,
  onChangeCooksFor,
  onChangeDietary,
}: SetupSummaryProps) => {
  const { t } = useTranslation();
  const [changingHousehold, setChangingHousehold] = useState(false);
  const lines = summaryLines(summary, t);

  if (lines.length === 0) {
    return (
      <Text role="body" align="center" style={styles.lead}>
        {t('onBoarding.nothingSetUp')}
      </Text>
    );
  }
  return (
    <View style={styles.summary}>
      <Text role="bodyStrong" align="center" style={styles.lead}>
        {t('onBoarding.summaryLead')}
      </Text>
      {lines.map(line => {
        const onPress =
          line.kind === 'household'
            ? () => setChangingHousehold(open => !open)
            : line.kind === 'dietary'
            ? onChangeDietary
            : undefined;
        return (
          <View key={line.kind}>
            {onPress ? (
              <AppPressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityHint={t('onBoarding.summaryChangeHint')}
                style={styles.line}
                testID={onboardingTestIDs.summaryLine(line.kind)}
              >
                <Text role="body" tone="secondary">{`• ${line.text}`}</Text>
                <Icon name="pencil-outline" size="sm" tone="primary" />
              </AppPressable>
            ) : (
              <View style={styles.line}>
                <Text role="body" tone="secondary">{`• ${line.text}`}</Text>
              </View>
            )}
            {line.kind === 'household' && summary.cooksFor !== null ? (
              <Reveal open={changingHousehold}>
                <PeopleStepper
                  value={summary.cooksFor}
                  min={1}
                  max={COOKS_FOR_MAX}
                  onChange={onChangeCooksFor}
                  label={t('onBoarding.householdTitle')}
                />
              </Reveal>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  summary: {
    alignSelf: 'stretch',
    marginBottom: theme.spacing.xl,
  },
  lead: {
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    minHeight: theme.sizes.button.sm,
  },
}));
