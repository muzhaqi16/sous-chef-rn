import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslateFn } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { Loading } from '#components/molecules/Loading';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { commonStyles } from '#/styles/commonStyles';
import { formatRelativeToNow } from '#/utils/formatters/date';
import { StoreRow } from '#features/catalog/ui/StoreRow';
import {
  useListSavings,
  type SavingsStore,
} from '#features/shoppingList/hooks/useListSavings';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';

/** The list's store; else not enough prices; else the saving, or none. */
const statusOf = (store: SavingsStore, t: TranslateFn): string | null => {
  if (store.isTarget) return t('listSavings.listStore');
  if (store.total === null) return t('listSavings.notEnoughPrices');
  const { saving } = store;
  if (!saving) return null;
  const on = t('listSavings.onItems', { count: saving.coveredLines });
  const said =
    saving.kind === 'aboutTheSame'
      ? t('listSavings.aboutTheSame')
      : saving.kind === 'save'
      ? t('listSavings.save', { amount: saving.amount })
      : t('listSavings.more', { amount: saving.amount });
  return `${said} ${on}`;
};

/**
 * Could you save? The list at its store and the household's usual stores:
 * each store's total for the unbought lines, and what it saves against the
 * list's store, as the server judged them. A store opens its item view.
 * Offline it shows the last answer, saying when it was given.
 */
export const ListSavingsSection: React.FC<{
  listId: string;
  homeId: string | null;
}> = ({ listId, homeId }) => {
  const { t } = useTranslation();
  const readingSystem = useReadingSystem();
  const { toUsualStores, toStoreSavingsItems } = useAppNavigation();
  const { offered, savings, loading, failed } = useListSavings(listId);

  const body = () => {
    if (loading) return <Loading size="small" />;
    if (!savings) {
      return (
        <Text role="caption" tone="secondary">
          {t('listSavings.needsConnection')}
        </Text>
      );
    }
    if (savings.stores.length === 0) {
      return (
        <Text role="body" tone="secondary">
          {t('listSavings.empty')}
        </Text>
      );
    }
    return savings.stores.map(store => {
      const status = statusOf(store, t);
      return (
        <StoreRow
          key={store.option.key}
          option={store.option}
          readingSystem={readingSystem}
          detail={store.standIn ?? undefined}
          status={
            status
              ? {
                  tone: store.saving?.kind === 'save' ? 'info' : 'neutral',
                  text: status,
                }
              : undefined
          }
          trailing={
            store.total ? (
              <Text role="bodyStrong">{store.total}</Text>
            ) : undefined
          }
          onPress={() => {
            toStoreSavingsItems({ listId, storeKey: store.option.key });
          }}
          testID={shoppingListTestIDs.listSavingsStore(store.option.key)}
        />
      );
    });
  };

  if (!offered) return null;

  return (
    <View
      style={commonStyles.settingsSection}
      testID={shoppingListTestIDs.listSavings}
    >
      <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
        {t('listSavings.title')}
      </Text>
      {/* The last answer stands while a new one cannot be had. */}
      {failed && savings ? (
        <Text role="caption" tone="tertiary">
          {t('listSavings.pricesAsOf', {
            age: formatRelativeToNow(new Date(savings.answeredAt)),
          })}
        </Text>
      ) : null}
      <View style={styles.body}>{body()}</View>
      <Button
        variant="ghost"
        size="small"
        title={t('usualStores.title')}
        onPress={() => {
          toUsualStores({ homeId });
        }}
        testID={shoppingListTestIDs.listSavingsYourStores}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  body: {
    marginTop: theme.spacing.md,
  },
}));
