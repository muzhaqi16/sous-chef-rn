import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import {
  strictestFirst,
  type HouseholdAlert,
  type HouseholdCheck,
} from '#domain/dietary';
import { HouseholdAlertLine } from '#features/profile/ui/HouseholdAlertLine';
import { Card } from '#components/atoms/Card';
import { RowCard } from '#components/atoms/RowCard';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { Text } from '#components/atoms/Text';
import { ListItem } from '#components/molecules/ListItem';
import type { DietaryAlternative } from '#features/barcode/hooks/useProductDietaryAlerts';
import { barcodeTestIDs } from '#features/barcode/testIDs';

interface HouseholdAlertsSectionProps {
  check: HouseholdCheck;
  alerts: HouseholdAlert[];
  alternatives: DietaryAlternative[];
  /** Opens an alternative's own result; absent, the alternatives only list. */
  onOpenAlternative?: (alternative: DietaryAlternative) => void;
}

/**
 * What a scanned product means for the household, above the card's actions.
 * Nothing found shows nothing: the app never calls a product safe.
 */
export const HouseholdAlertsSection: React.FC<HouseholdAlertsSectionProps> = ({
  check,
  alerts,
  alternatives,
  onOpenAlternative,
}) => {
  const { t } = useTranslation();

  if (check === 'unchecked') {
    return (
      <Card style={styles.card} testID={barcodeTestIDs.householdUnchecked}>
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
    <Card style={styles.card} testID={barcodeTestIDs.householdAlerts}>
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
      {alternatives.length > 0 && (
        <View style={styles.alternatives}>
          <Text
            role="bodyStrong"
            tone="secondary"
            style={styles.alternativesTitle}
          >
            {t('barcode.household.alternatives')}
          </Text>
          {alternatives.map(alternative => (
            <RowCard
              key={alternative.id}
              testID={barcodeTestIDs.householdAlternative(alternative.id)}
            >
              <ListItem
                title={alternative.name}
                leftElement={<RowThumbnail uri={alternative.imageUrl} />}
                onPress={
                  onOpenAlternative && alternative.primaryUpc
                    ? () => onOpenAlternative(alternative)
                    : undefined
                }
                accessibilityLabel={t('barcode.household.openAlternative', {
                  name: alternative.name,
                })}
              />
            </RowCard>
          ))}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  alternatives: {
    marginTop: theme.spacing.sm,
  },
  alternativesTitle: {
    marginBottom: theme.spacing.xs,
  },
}));
