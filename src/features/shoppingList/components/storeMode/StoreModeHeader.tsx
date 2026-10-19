import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { AppPressable } from '#components/atoms/AppPressable';
import { ProgressBar } from '#components/atoms/ProgressBar';
import { FilterTabs } from '#components/organisms/FilterTabs/FilterTabs';
import type { FilterTabConfig } from '#components/organisms/FilterTabs/types';
import { Icon, type IconName } from '#components/atoms/Icon';
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
      <View style={styles.progress}>
        <Text role="label">
          {t('shoppingListScreens.storeMode.inCart', {
            done: cartCount,
            count: totalCount,
          })}
        </Text>
        <ProgressBar value={totalCount > 0 ? cartCount / totalCount : 0} />
      </View>
      <View style={styles.details}>
        {storeName ? (
          <DetailLine icon="storefront-outline">
            {t('shoppingListScreens.storeMode.atStore', { store: storeName })}
          </DetailLine>
        ) : (
          <AppPressable
            onPress={onChooseStore}
            accessibilityRole="button"
            testID={shoppingListTestIDs.storeModeChooseStore}
          >
            <DetailLine icon="storefront-outline" accent>
              {t('shoppingListScreens.storeMode.chooseStore')}
            </DetailLine>
          </AppPressable>
        )}
        {estimateText ? (
          <DetailLine icon="pricetag-outline">{estimateText}</DetailLine>
        ) : null}
        {routeNote ? (
          <DetailLine
            icon="walk-outline"
            testID={shoppingListTestIDs.aisleRouteNote}
          >
            {t(
              routeNote.ownTrips
                ? 'shoppingListScreens.aisles.yourRoute'
                : 'shoppingListScreens.aisles.shoppersRoute',
              { store: routeNote.storeName },
            )}
          </DetailLine>
        ) : null}
      </View>
      <View style={styles.tabs}>
        <FilterTabs<StoreModeTab>
          tabs={tabs}
          activeTabId={tab}
          onTabChange={onTabChange}
          counts={counts}
          testIDPrefix={shoppingListTestIDs.aisleTabPrefix}
        />
      </View>
    </View>
  );
};

/** One fact about the trip, behind the icon that names its kind. */
const DetailLine: React.FC<{
  icon: IconName;
  accent?: boolean;
  testID?: string;
  children: string;
}> = ({ icon, accent = false, testID, children }) => (
  <View style={styles.detailLine} testID={testID}>
    <Icon
      name={icon}
      size={DETAIL_ICON_SIZE}
      tone={accent ? 'primary' : 'textSecondary'}
    />
    <Text
      role="footnote"
      tone={accent ? 'accent' : 'secondary'}
      style={styles.detailText}
    >
      {children}
    </Text>
  </View>
);

const DETAIL_ICON_SIZE = 16;

const styles = StyleSheet.create(theme => ({
  header: {
    paddingHorizontal: theme.layout.pageGutter,
    paddingTop: theme.spacing.base,
  },
  progress: {
    gap: theme.spacing.sm,
  },
  details: {
    gap: theme.spacing.xsPlus,
    marginTop: theme.spacing.base,
  },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xsPlus,
  },
  detailText: {
    flexShrink: 1,
  },
  tabs: {
    marginTop: theme.spacing.md,
  },
}));
