import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { AppPressable } from '#components/atoms/AppPressable';
import { ProgressBar } from '#components/atoms/ProgressBar';
import { FilterTabs } from '#components/organisms/FilterTabs/FilterTabs';
import type { FilterTabConfig } from '#components/organisms/FilterTabs/types';
import { Icon } from '#utils/iconUtils';
import { useTranslation } from '#/i18n';
import type { AisleHeaderRow } from '#features/shoppingList/components/SortableShoppingList/types';
import type { AisleRouteNote } from '#features/shoppingList/hooks/useAisleView';
import type {
  StoreModeEstimate,
  StoreModeTab,
} from '#features/shoppingList/hooks/useStoreMode';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';

interface StoreModeHeaderProps {
  cartCount: number;
  totalCount: number;
  estimate: StoreModeEstimate | null;
  storeName: string | null;
  onChooseStore: () => void;
  routeNote: AisleRouteNote | null;
  aisles: AisleHeaderRow[];
  lineCount: number;
  tab: StoreModeTab;
  onTabChange: (tab: StoreModeTab) => void;
}

/**
 * How far the trip is, where it is, and the pantry's location row over the
 * list's aisles, with the cart last. Sits above the list, so it owns its inset.
 */
export const StoreModeHeader: React.FC<StoreModeHeaderProps> = ({
  cartCount,
  totalCount,
  estimate,
  storeName,
  onChooseStore,
  routeNote,
  aisles,
  lineCount,
  tab,
  onTabChange,
}) => {
  const { t } = useTranslation();

  const tabs: FilterTabConfig<StoreModeTab>[] = [
    { id: 'all', label: t('shoppingListScreens.aisles.all') },
    ...aisles.map(aisle => ({
      id: aisle.department,
      label: t(`shoppingListScreens.aisles.department.${aisle.department}`),
    })),
    {
      id: 'cart',
      label: t('shoppingListScreens.storeMode.cart'),
      icon: 'cart-outline',
    },
  ];
  const counts: Partial<Record<StoreModeTab, number>> = {
    all: lineCount,
    cart: cartCount,
  };
  for (const aisle of aisles) counts[aisle.department] = aisle.count;

  const estimateText =
    estimate &&
    (estimate.priced === estimate.lines
      ? t('shoppingListScreens.storeMode.estimate', { price: estimate.price })
      : t('shoppingListScreens.storeMode.estimatePartial', {
          price: estimate.price,
          priced: estimate.priced,
          count: estimate.lines,
        }));

  return (
    <View style={styles.header}>
      <View style={styles.summary}>
        <Text role="label">
          {t('shoppingListScreens.storeMode.inCart', {
            done: cartCount,
            count: totalCount,
          })}
        </Text>
        <ProgressBar value={totalCount > 0 ? cartCount / totalCount : 0} />
        {estimateText ? (
          <Text role="footnote" tone="secondary">
            {estimateText}
          </Text>
        ) : null}
        {storeName ? (
          <Text role="footnote" tone="secondary">
            {t('shoppingListScreens.storeMode.atStore', { store: storeName })}
          </Text>
        ) : (
          <AppPressable
            onPress={onChooseStore}
            accessibilityRole="button"
            testID={shoppingListTestIDs.storeModeChooseStore}
          >
            <Text role="footnote" tone="accent">
              {t('shoppingListScreens.storeMode.chooseStore')}
            </Text>
          </AppPressable>
        )}
        {routeNote ? (
          <View
            style={styles.routeNote}
            testID={shoppingListTestIDs.aisleRouteNote}
          >
            <Icon name="walk-outline" size={16} tone="textSecondary" />
            <Text role="footnote" tone="secondary" style={styles.routeNoteText}>
              {routeNote.ownTrips
                ? t('shoppingListScreens.aisles.yourRoute', {
                    store: routeNote.storeName,
                  })
                : t('shoppingListScreens.aisles.shoppersRoute', {
                    store: routeNote.storeName,
                  })}
            </Text>
          </View>
        ) : null}
      </View>
      <FilterTabs<StoreModeTab>
        tabs={tabs}
        activeTabId={tab}
        onTabChange={onTabChange}
        counts={counts}
        testIDPrefix={shoppingListTestIDs.aisleTabPrefix}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    paddingHorizontal: theme.layout.pageGutter,
  },
  summary: {
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
  },
  routeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  routeNoteText: {
    flexShrink: 1,
  },
}));
