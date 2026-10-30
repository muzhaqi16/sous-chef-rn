import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { Loading } from '#components/molecules/Loading';
import { useTranslation } from '#/i18n';
import { commonStyles } from '#/styles/commonStyles';
import { useIsOnline } from '#store/useAppStore';
import { formatCurrency } from '#/utils/formatters/number';
import {
  useListStoreComparison,
  type StoreComparison,
  type StoreComparisonCandidate,
} from '#features/shoppingList/hooks/useListStoreComparison';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';

/** Where the list's unbought items cost least, at the household's usual stores. */
export const StoreComparisonSection: React.FC<{ listId: string }> = ({
  listId,
}) => {
  const { t } = useTranslation();
  const isOnline = useIsOnline();
  const { comparison, loading, failed } = useListStoreComparison(listId);

  const body = () => {
    if (loading) return <Loading size="small" />;
    if (failed || !comparison) {
      return (
        <Text role="caption" tone="secondary">
          {isOnline
            ? t('shoppingListScreens.storeComparison.failed')
            : t('errors.notAvailableOffline')}
        </Text>
      );
    }
    return <ComparisonBody comparison={comparison} />;
  };

  return (
    <View
      style={commonStyles.settingsSection}
      testID={shoppingListTestIDs.storeComparison}
    >
      <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
        {t('shoppingListScreens.storeComparison.title')}
      </Text>
      <View style={styles.body}>{body()}</View>
    </View>
  );
};

const ComparisonBody: React.FC<{ comparison: StoreComparison }> = ({
  comparison,
}) => {
  const { t } = useTranslation();
  const notes = [
    comparison.leftOutLines > 0 &&
      t('shoppingListScreens.storeComparison.leftOut', {
        count: comparison.leftOutLines,
      }),
    comparison.truncated && t('shoppingListScreens.storeComparison.truncated'),
  ].filter(note => typeof note === 'string');

  return (
    <>
      <Text role="caption" tone="secondary">
        {t('shoppingListScreens.storeComparison.compared', {
          count: comparison.comparableLines,
        })}
      </Text>
      {comparison.candidates.length === 0 ? (
        <Text role="body" tone="secondary">
          {t('shoppingListScreens.storeComparison.empty')}
        </Text>
      ) : (
        comparison.candidates.map(candidate => (
          <CandidateRow
            key={candidate.key}
            candidate={candidate}
            comparison={comparison}
          />
        ))
      )}
      {notes.map(note => (
        <Text key={note} role="caption" tone="tertiary">
          {note}
        </Text>
      ))}
    </>
  );
};

const CandidateRow: React.FC<{
  candidate: StoreComparisonCandidate;
  comparison: StoreComparison;
}> = ({ candidate, comparison }) => {
  const { t } = useTranslation();
  // Null unless its shelf prices cover half the lines: no total that compares.
  const { total } = candidate;
  // How much of the total rests on this store's own shelf prices.
  const breakdown = [
    t('shoppingListScreens.storeComparison.pricedHere', {
      count: candidate.pricedLines,
    }),
    candidate.estimatedLines > 0 &&
      t('shoppingListScreens.storeComparison.typical', {
        count: candidate.estimatedLines,
      }),
  ]
    .filter(part => typeof part === 'string')
    .join(' · ');

  return (
    <View
      style={commonStyles.settingsRow}
      testID={shoppingListTestIDs.storeComparisonCandidate(candidate.key)}
    >
      <View style={commonStyles.settingsRowInfo}>
        <Text role="bodyStrong">{candidate.name}</Text>
        {candidate.isTarget ? (
          <Text role="caption" tone="accent">
            {t('shoppingListScreens.storeComparison.yourStore')}
          </Text>
        ) : null}
        {candidate.address ? (
          <Text role="caption" tone="secondary">
            {candidate.address}
          </Text>
        ) : null}
        <Text role="caption" style={commonStyles.settingsRowDescription}>
          {breakdown}
        </Text>
      </View>
      <Text
        role={total == null ? 'caption' : 'bodyStrong'}
        tone={total == null ? 'secondary' : 'primary'}
        style={styles.total}
      >
        {total == null
          ? t('listSavings.notEnoughPrices')
          : formatCurrency(
              total,
              comparison.currencyCode,
              comparison.decimalPlaces,
            )}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  body: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  total: {
    maxWidth: '40%',
    marginStart: theme.spacing.sm,
    textAlign: 'right',
  },
}));
