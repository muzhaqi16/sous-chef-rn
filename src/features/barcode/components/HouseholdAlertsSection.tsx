import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import {
  DietaryAlertState,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { Card } from '#components/atoms/Card';
import { Icon } from '#components/atoms/Icon';
import { RowCard } from '#components/atoms/RowCard';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { Text } from '#components/atoms/Text';
import { ListItem } from '#components/molecules/ListItem';
import type {
  DietaryAlternative,
  HouseholdCheck,
  ProductDietaryAlert,
} from '#features/barcode/hooks/useProductDietaryAlerts';
import { barcodeTestIDs } from '#features/barcode/testIDs';

interface HouseholdAlertsSectionProps {
  check: HouseholdCheck;
  alerts: ProductDietaryAlert[];
  alternatives: DietaryAlternative[];
  /** Opens an alternative's own result; absent, the alternatives only list. */
  onOpenAlternative?: (alternative: DietaryAlternative) => void;
}

const isStrict = (severity: RestrictionSeverity) =>
  severity === RestrictionSeverity.Allergy ||
  severity === RestrictionSeverity.Intolerance;

/** "Ana: contains peanut", or for a diet "Sam: not vegan"; may-contain softer. */
const frameKey = (alert: ProductDietaryAlert): TranslationKey => {
  const contains = alert.state === DietaryAlertState.Contains;
  if (alert.isDiet) {
    return contains
      ? 'barcode.household.notDiet'
      : 'barcode.household.mayNotDiet';
  }
  return contains
    ? 'barcode.household.contains'
    : 'barcode.household.mayContain';
};

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
          {t('barcode.household.needsConnection')}
        </Text>
      </Card>
    );
  }
  if ((check !== 'checked' && check !== 'stale') || alerts.length === 0) {
    return null;
  }

  return (
    <Card style={styles.card} testID={barcodeTestIDs.householdAlerts}>
      <Text role="bodyStrong">{t('barcode.household.title')}</Text>
      {alerts.map(alert => {
        const strict = isStrict(alert.severity);
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
              {t(frameKey(alert), { name: alert.memberName, what: alert.what })}
            </Text>
          </View>
        );
      })}
      {check === 'stale' && (
        <Text role="caption" tone="secondary">
          {t('barcode.household.stale')}
        </Text>
      )}
      <Text role="caption" tone="tertiary">
        {t('barcode.household.checkLabel')}
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
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  alertText: {
    flex: 1,
  },
  alternatives: {
    marginTop: theme.spacing.sm,
  },
  alternativesTitle: {
    marginBottom: theme.spacing.xs,
  },
}));
