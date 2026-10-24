import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Card } from '#components/atoms/Card';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import {
  householdAlertKey,
  isStrictSeverity,
  type HouseholdAlert,
  type HouseholdCheck,
} from '#domain/dietary';
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
      {alerts.map(alert => {
        const strict = isStrictSeverity(alert.severity);
        return (
          <View key={alert.id} style={styles.alertRow}>
            <Icon
              name={strict ? 'alert-circle' : 'information-circle-outline'}
              size="sm"
              tone={strict ? 'danger' : 'iconSecondary'}
            />
            <Text
              role="body"
              tone={strict ? 'danger' : 'secondary'}
              style={styles.alertText}
            >
              {t(householdAlertKey(alert), {
                name: alert.memberName,
                what: alert.what,
              })}
            </Text>
          </View>
        );
      })}
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
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  alertText: {
    flex: 1,
  },
}));
