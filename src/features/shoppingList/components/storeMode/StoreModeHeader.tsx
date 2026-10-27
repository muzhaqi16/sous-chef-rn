import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { AppPressable } from '#components/atoms/AppPressable';
import { ProgressBar } from '#components/atoms/ProgressBar';
import { Reveal } from '#components/atoms/Reveal';
import { StoreAutocompleteField } from '#features/catalog/ui/autocomplete/StoreAutocompleteField';
import { FilterTabs } from '#components/organisms/FilterTabs/FilterTabs';
import type { FilterTabConfig } from '#components/organisms/FilterTabs/types';
import { Icon, type IconName } from '#components/atoms/Icon';
import { useTranslation } from '#/i18n';
import type { AisleHeaderRow } from '#features/shoppingList/components/SortableShoppingList/types';
import type { AisleRouteNote } from '#features/shoppingList/screens/useAisleView';
import type {
  StoreModeEstimate,
  StoreModeTab,
} from '#features/shoppingList/screens/useStoreMode';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';

interface StoreModeHeaderProps {
  cartCount: number;
  totalCount: number;
  estimate: StoreModeEstimate | null;
  storeName: string | null;
  canChooseStore: boolean;
  onChooseStore: (store: { id: string; name: string }) => void;
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
  canChooseStore,
  onChooseStore,
  routeNote,
  aisles,
  lineCount,
  tab,
  onTabChange,
}) => {
  const { t } = useTranslation();
  const [choosingStore, setChoosingStore] = useState(false);
  const [storeText, setStoreText] = useState<string | null>(null);
  const storeLine = storeName
    ? t('shoppingListScreens.storeMode.atStore', { store: storeName })
    : t('shoppingListScreens.storeMode.chooseStore');

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

  // Off, the trip reads as what is left to buy, with no cost.
  const showPrices = useBudgetAndPricesEnabled();
  const estimateText =
    showPrices &&
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
        {canChooseStore ? (
          <AppPressable
            onPress={() => setChoosingStore(open => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: choosingStore }}
            testID={shoppingListTestIDs.storeModeChooseStore}
          >
            <DetailLine icon="storefront-outline" accent={!storeName}>
              {storeLine}
            </DetailLine>
          </AppPressable>
        ) : storeName ? (
          <DetailLine icon="storefront-outline">{storeLine}</DetailLine>
        ) : null}
        {canChooseStore ? (
          <Reveal open={choosingStore}>
            <StoreAutocompleteField
              variant="modal"
              label={t('labels.store')}
              value={storeText ?? storeName ?? ''}
              onChangeText={setStoreText}
              // Kept by id, from the pick: typed text alone is no store.
              onStoreSelected={(id, name) => {
                if (!id || !name) return;
                onChooseStore({ id, name });
                setStoreText(null);
                setChoosingStore(false);
              }}
              placeholder={t('shoppingListScreens.storePlaceholder')}
              helperText={t('labels.storeSelectHint')}
              testID={shoppingListTestIDs.storeModeStoreField}
            />
          </Reveal>
        ) : null}
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
