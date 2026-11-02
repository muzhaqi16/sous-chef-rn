import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Card } from '#components/atoms/Card';
import { Text } from '#components/atoms/Text';
import type { HouseholdCheck } from '#domain/dietary';
import { recipesTestIDs } from '#features/recipes/testIDs';

interface DietaryCheckNoteProps {
  check: HouseholdCheck;
  /** An ingredient shows an alert, which an earlier answer may have overtaken. */
  flagged: boolean;
  /** Whether a restriction can alert, so a stale empty answer is worth noting. */
  restrictionsApply: boolean;
}

/**
 * When the ingredients' alerts cannot be relied on: the check could not run, or
 * its answer is from earlier. Each alert sits on its ingredient, so a settled
 * check shows no note, never wording that calls the recipe safe.
 */
export const DietaryCheckNote: React.FC<DietaryCheckNoteProps> = ({
  check,
  flagged,
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
  if (check !== 'stale' || (!flagged && !restrictionsApply)) return null;

  return (
    <Card style={styles.card} testID={recipesTestIDs.householdStale}>
      <Text role="caption" tone="secondary">
        {t('dietaryAlerts.stale')}
      </Text>
    </Card>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    padding: theme.spacing.lg,
  },
}));
