import React from 'react';
import { View } from 'react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslateFn } from '#/i18n';
import type { BadgeContent } from '#components/atoms/Badge';
import { StatusLine } from '#components/atoms/StatusLine';
import { Text } from '#components/atoms/Text';
import { ItemList } from '#components/organisms/ItemList';
import { SubScreen } from '#components/templates/SubScreen';
import { useDataState } from '#hooks/data/useDataState';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { rowType } from '#/theme/foundations/type';
import { accessibilityLabelOf } from '#/utils/accessibilityLabel';
import { describeStoreOption } from '#domain/stores';
import {
  useStoreSavingsLines,
  type SavingsLine,
} from '#features/shoppingList/hooks/useListSavings';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';

const badgeOf = (
  line: SavingsLine,
  t: TranslateFn,
): BadgeContent | undefined => {
  switch (line.kind) {
    case 'similar':
      return { text: t('listSavings.similar'), variant: 'primary' };
    case 'estimated':
      return { text: t('listSavings.estimated') };
    case 'same':
    case 'none':
      return undefined;
  }
};

/** The list store's price for the line, and the gap where both are on the shelf. */
const comparisonOf = (line: SavingsLine, t: TranslateFn): string | null => {
  if (!line.atListStore) return null;
  const there = t('listSavings.atListStore', { price: line.atListStore });
  if (!line.difference) return there;
  const gap =
    line.difference.kind === 'cheaper'
      ? t('listSavings.cheaperBy', { amount: line.difference.amount })
      : t('listSavings.dearerBy', { amount: line.difference.amount });
  return `${there} · ${gap}`;
};

/** A line's facts, one to a row line: the product, why it's estimated, the gap, its age. */
const detailsOf = (line: SavingsLine, t: TranslateFn) => ({
  product: line.product,
  estimated: line.kind === 'estimated' ? t('listSavings.estimatedHint') : null,
  comparison: comparisonOf(line, t),
  lastSeen: line.lastSeen,
});

/**
 * One store's prices for the list's unbought lines, against the list's store,
 * from the answer "Could you save?" stored: it opens offline and asks nothing.
 * Its header names the stand-in a store's prices come from.
 */
export const StoreSavingsItems: React.FC<
  StaticScreenProps<{ listId: string; storeKey: string }>
> = ({ route }) => {
  useScreenTransition('StoreSavingsItems');
  const { listId, storeKey } = route.params;
  const { t } = useTranslation();
  const readingSystem = useReadingSystem();
  const { toShoppingListItemDetail } = useAppNavigation();
  const { store, loading, retry } = useStoreSavingsLines(listId, storeKey);
  const state = useDataState({
    loading,
    error: undefined,
    hasResult: !!store,
    isEmpty: store?.lines.length === 0,
  });

  return (
    <SubScreen
      title={
        store
          ? describeStoreOption(store.option, t, readingSystem).title
          : t('listSavings.title')
      }
      scroll="list"
      gutter="none"
      state={{ value: state, onRetry: retry }}
      testID={shoppingListTestIDs.storeSavingsItemsScreen}
    >
      <ItemList
        items={(store?.lines ?? []).map(line => {
          const badge = badgeOf(line, t);
          const details = detailsOf(line, t);
          const price = line.price ?? t('listSavings.noPrice');
          const shown = Object.values(details).some(Boolean);
          return {
            id: line.lineId,
            title: line.name,
            subtitle: shown ? (
              <>
                {details.product ? (
                  <Text role={rowType.subtitle} numberOfLines={2}>
                    {details.product}
                  </Text>
                ) : null}
                {details.estimated ? (
                  <Text role={rowType.subtitle} numberOfLines={2}>
                    {details.estimated}
                  </Text>
                ) : null}
                {details.comparison ? (
                  <StatusLine
                    tone={
                      line.difference?.kind === 'cheaper' ? 'info' : 'neutral'
                    }
                  >
                    {details.comparison}
                  </StatusLine>
                ) : null}
                {details.lastSeen ? (
                  <Text role={rowType.subtitle} numberOfLines={1}>
                    {details.lastSeen}
                  </Text>
                ) : null}
              </>
            ) : (
              ''
            ),
            badge,
            imageUrl: line.photoUrl ?? undefined,
            rightElement: (
              <Text
                role={line.price ? 'bodyStrong' : 'caption'}
                tone={
                  line.kind === 'same' || line.kind === 'similar'
                    ? 'primary'
                    : 'secondary'
                }
              >
                {price}
              </Text>
            ),
            accessibilityLabel: accessibilityLabelOf(
              line.name,
              price,
              badge?.text,
              details.product,
              details.estimated,
              details.comparison,
              details.lastSeen,
            ),
          };
        })}
        onItemPress={itemId => {
          toShoppingListItemDetail({ listId, itemId });
        }}
        testIDPrefix={shoppingListTestIDs.storeSavingsLine}
        ListHeaderComponent={
          <View style={styles.header}>
            {store?.standIn ? (
              <Text role="caption" tone="secondary">
                {store.standIn}
              </Text>
            ) : null}
          </View>
        }
      />
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
}));
