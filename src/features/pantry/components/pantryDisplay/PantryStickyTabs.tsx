import React, { createContext, useContext } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FilterTabs } from '#components/molecules/FilterTabs/FilterTabs';
import type { LocationFilter } from '#features/pantry/utils/pantryFilters';

/**
 * The list's sticky filter tabs (row 0, via `stickyHeaderIndices`) and the
 * context they read from. FlashList 2.3.2's `ViewHolder` memo-compares BOTH
 * `extraData` and `renderItem` by reference, so tab state must reach them
 * through context, not a closure — else every cell re-renders on a filter change.
 */

// Derived from the component so a FilterTabs prop change reaches this through
// typecheck.
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
