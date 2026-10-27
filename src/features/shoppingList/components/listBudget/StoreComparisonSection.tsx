import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { Loading } from '#components/molecules/Loading';
import { ModeTabs } from '#components/molecules/ModeTabs';
import { useTranslation } from '#/i18n';
import { commonStyles } from '#/styles/commonStyles';
import { useIsOnline } from '#store/useAppStore';
import { PriceComparisonScope } from '#/graphql/generated/schemaTypes';
import { formatCurrency } from '#/utils/formatters/number';
import { formatRelativeToNow } from '#/utils/formatters/date';
import {
  useListStoreComparison,
  type StoreComparison,
  type StoreComparisonCandidate,
} from '#features/shoppingList/hooks/useListStoreComparison';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';

const SCOPES = [PriceComparisonScope.Store, PriceComparisonScope.Chain];

interface StoreComparisonSectionProps {
  listId: string;
  scope: PriceComparisonScope;
  onScopeChange: (scope: PriceComparisonScope) => void;
}

/** Where the list's unbought items cost least, from recorded prices. */
export const StoreComparisonSection: React.FC<StoreComparisonSectionProps> = ({
  listId,
  scope,
  onScopeChange,
}) => {
  const { t } = useTranslation();
  const isOnline = useIsOnline();
  const { comparison, loading, failed } = useListStoreComparison(listId, scope);

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
      <ModeTabs
        options={SCOPES}
        value={scope}
        onChange={onScopeChange}
        formatLabel={value =>
          value === PriceComparisonScope.Store
            ? t('shoppingListScreens.storeComparison.scopeStores')
            : t('shoppingListScreens.storeComparison.scopeChains')
        }
      />
      <View style={styles.body}>{body()}</View>
    </View>
  );
};

const ComparisonBody: React.FC<{ comparison: StoreComparison }> = ({
  comparison,
}) => {
  const { t } = useTranslation();
  const notes = [
    comparison.unpricedLines > 0 &&
      t('shoppingListScreens.storeComparison.unpriced', {
        count: comparison.unpricedLines,
      }),
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
  // Only a candidate pricing enough lines itself shows a total that compares.
  const total = candidate.ranked ? candidate.estimatedTotal : null;
  // How much of the total rests on this candidate's own prices.
  const breakdown = [
    t('shoppingListScreens.storeComparison.pricedHere', {
      count: candidate.pricedLines,
    }),
    candidate.chainFilledLines > 0 &&
      candidate.chainName &&
      t('shoppingListScreens.storeComparison.fromChain', {
        count: candidate.chainFilledLines,
        chain: candidate.chainName,
      }),
    candidate.anyStoreFilledLines > 0 &&
      t('shoppingListScreens.storeComparison.typical', {
        count: candidate.anyStoreFilledLines,
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
        {candidate.newestObservedAt ? (
          <Text role="caption" tone="tertiary">
            {t('shoppingListScreens.storeComparison.newestPrice', {
              age: formatRelativeToNow(new Date(candidate.newestObservedAt)),
            })}
          </Text>
        ) : null}
      </View>
      {/* An unranked total rests mostly on other stores' prices. */}
      <Text
        role={total == null ? 'caption' : 'bodyStrong'}
        tone={total == null ? 'secondary' : 'primary'}
        style={styles.total}
      >
        {total == null
          ? t('shoppingListScreens.storeComparison.notEnoughPrices')
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
