import React, { createContext, useContext } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FilterTabs } from '#components/molecules/FilterTabs/FilterTabs';
import type { LocationFilter } from '#features/pantry/utils/pantryFilters';

/**
 * The pantry list's sticky filter tabs, and the context they read from.
 *
 * The tabs are row 0 of the FlashList (pinned via `stickyHeaderIndices`), so
 * they have to come through `renderItem` — but not an inline one closing over
 * the filter state, which re-renders every mounted item cell whenever the
 * filter changes, through BOTH of FlashList's re-render triggers.
 *
 * Verified against the installed `@shopify/flash-list@2.3.2`: `ViewHolder`'s
 * `React.memo` comparator (`src/recyclerview/ViewHolder.tsx`) compares
 * `extraData` AND `renderItem` by reference —
 *
 *     prevProps.extraData === nextProps.extraData &&
 *     prevProps.renderItem === nextProps.renderItem &&
 *
 * — so an inline `renderItem` closing over filter state re-renders every cell
 * even with `extraData` left alone, and vice versa. Both had to go.
 *
 * No item cell reads any of it: the leaf `renderItem` uses only `item`, and
 * `PantryItemCard` owns its own cache subscription through `useFragment`. So
 * the tabs take their state from this context instead of from a closure, which
 * lets `renderPantryListItem` live at module scope with a permanently stable
 * identity, and lets `locationFilter` come out of `extraData`.
 */
// Derived from the component rather than restated, so a change to FilterTabs'
// props reaches this context through typecheck.
type FilterTabsProps = Parameters<typeof FilterTabs<LocationFilter>>[0];

type PantryStickyTabsValue = Pick<
  FilterTabsProps,
  'tabs' | 'activeTabId' | 'onTabChange' | 'counts'
>;

const PantryStickyTabsContext = createContext<PantryStickyTabsValue | null>(
  null,
);

export const PantryStickyTabsProvider = PantryStickyTabsContext.Provider;

interface PantryStickyTabsProps {
  /** True while FlashList is rendering this row pinned to the top. */
  pinned: boolean;
}

export const PantryStickyTabs: React.FC<PantryStickyTabsProps> = ({
  pinned,
}) => {
  const value = useContext(PantryStickyTabsContext);
  // Rendered only as row 0 of the pantry list, always inside the provider.
  if (!value) return null;

  return (
    <View style={[styles.stickySection, pinned && styles.stickyHeaderActive]}>
      <FilterTabs<LocationFilter>
        tabs={value.tabs}
        activeTabId={value.activeTabId}
        onTabChange={value.onTabChange}
        counts={value.counts}
        testIDPrefix="pantry-location-tab"
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  stickySection: {
    backgroundColor: theme.colors.background,
    zIndex: theme.zIndex.sticky,
    paddingBottom: theme.spacing.sm,
  },
  stickyHeaderActive: {
    backgroundColor: theme.colors.background,
  },
}));
