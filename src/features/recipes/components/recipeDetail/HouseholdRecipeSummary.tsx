import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Card } from '#components/atoms/Card';
import { Text } from '#components/atoms/Text';
import {
  strictestFirst,
  type HouseholdAlert,
  type HouseholdCheck,
} from '#domain/dietary';
import { HouseholdAlertLine } from '#features/profile/ui/HouseholdAlertLine';
import { recipesTestIDs } from '#features/recipes/testIDs';

interface HouseholdRecipeSummaryProps {
  check: HouseholdCheck;
  alerts: HouseholdAlert[];
  /** Whether a restriction can alert, so a stale empty answer is worth noting. */
  restrictionsApply: boolean;
}

/**
 * Who in the household a recipe affects, near the top of its page. Nothing
 * flagged shows no card, never wording that calls the recipe safe.
 */
export const HouseholdRecipeSummary: React.FC<HouseholdRecipeSummaryProps> = ({
  check,
  alerts,
  restrictionsApply,
}) => {
  const { t } = useTranslation();

  if (check === 'unchecked' || check === 'failed') {
    return (
      <Card style={styles.card} testID={recipesTestIDs.householdUnchecked}>
        <Text role="caption" tone="secondary">
          {t(
            check === 'failed'
              ? 'dietaryAlerts.checkFailed'
              : 'dietaryAlerts.needsConnection',
          )}
        </Text>
      </Card>
    );
  }
  if (check !== 'checked' && check !== 'stale') return null;
  if (alerts.length === 0) {
    if (check !== 'stale' || !restrictionsApply) return null;
    return (
      <Card style={styles.card} testID={recipesTestIDs.householdStale}>
        <Text role="caption" tone="secondary">
          {t('dietaryAlerts.stale')}
        </Text>
      </Card>
    );
  }

  return (
    <Card style={styles.card} testID={recipesTestIDs.householdSummary}>
      <Text role="bodyStrong">{t('dietaryAlerts.title')}</Text>
      {strictestFirst(alerts).map(alert => (
        <HouseholdAlertLine key={alert.id} alert={alert} />
      ))}
      {check === 'stale' && (
        <Text role="caption" tone="secondary">
          {t('dietaryAlerts.stale')}
        </Text>
      )}
      <Text role="caption" tone="secondary">
        {t('dietaryAlerts.checkLabel')}
      </Text>
    </Card>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
}));
