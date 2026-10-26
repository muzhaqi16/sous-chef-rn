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
}

/**
 * Who in the household a recipe affects, near the top of its page. Nothing
 * found shows nothing: the app never calls a recipe safe.
 */
export const HouseholdRecipeSummary: React.FC<HouseholdRecipeSummaryProps> = ({
  check,
  alerts,
}) => {
  const { t } = useTranslation();

  if (check === 'unchecked') {
    return (
      <Card style={styles.card} testID={recipesTestIDs.householdUnchecked}>
        <Text role="caption" tone="secondary">
          {t('dietaryAlerts.needsConnection')}
        </Text>
      </Card>
    );
  }
  if ((check !== 'checked' && check !== 'stale') || alerts.length === 0) {
    return null;
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
      <Text role="caption" tone="tertiary">
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
