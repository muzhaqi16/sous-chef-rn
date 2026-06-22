import { View, type LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { EdgeFade } from '#components/atoms/EdgeFade';
import { useScrollEdgeFades } from '#hooks/ui/useScrollEdgeFades';
import { useCenterActiveItem } from '#hooks/ui/useCenterActiveItem';
import { FilterTabsItem } from './FilterTabsItem';
import type { FilterTabConfig, FilterTabsProps } from './types';
import { Text } from '#components/atoms/Text';

/**
 * Generic configurable tab filter component
 *
 * @example
 * // Pantry location filter
 * <FilterTabs
 *   tabs={[
 *     { id: 'all', label: 'All' },
 *     { id: 'fridge', label: 'Fridge', icon: '🧊' },
 *   ]}
 *   activeTabId={locationFilter}
 *   onTabChange={setLocationFilter}
 *   counts={locationCounts}
 * />
 */
function FilterTabsComponent<T extends string = string>({
  tabs,
  activeTabId,
  onTabChange,
  counts,
  showCounts = true,
  variant = 'default',
  testIDPrefix = 'filter-tab',
  actionButton,
  filteredTabIds,
}: FilterTabsProps<T>): React.ReactElement {
  // ── Scroll-edge fades ──
  // Show a soft fade on whichever side has more content scrolled off, so chips
  // read as scrollable instead of hard-clipped at the viewport edge. The hook
  // also exposes the live viewport/content widths in `metrics`, reused by the
  // centering hook below so the same numbers aren't measured twice.
  const { edges, metrics, onScroll, onContentSizeChange, onLayout } =
    useScrollEdgeFades();

  // ── Auto-center the active tab ──
  // `cacheKey` (the testID prefix) lets a sticky-header copy of this strip
  // start at the right offset without flicker by sharing the first instance's
  // measurements.
  const {
    onItemLayout,
    onScrollViewLayout,
    initialContentOffset,
    animatedRef,
  } = useCenterActiveItem({
    activeKey: activeTabId,
    metrics,
    cacheKey: testIDPrefix,
  });

  const handleScrollViewLayout = (e: LayoutChangeEvent) => {
    onLayout(e); // fade metrics
    onScrollViewLayout(e); // viewport-width cache for the sticky copy
  };

  const handleTabPress = (tabId: T) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.onPress) {
      tab.onPress();
    } else {
      onTabChange(tabId);
    }
  };

  const isCompact = variant === 'compact';

  styles.useVariants({
    compact: isCompact,
    actionDisabled: actionButton?.disabled ?? false,
  });

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={animatedRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
        onLayout={handleScrollViewLayout}
        onScroll={onScroll}
        onContentSizeChange={onContentSizeChange}
        scrollEventThrottle={16}
        contentOffset={initialContentOffset}
      >
        {tabs.map((tab: FilterTabConfig<T>) => (
          <FilterTabsItem
            key={tab.id}
            tab={tab}
            isActive={activeTabId === tab.id}
            isFiltered={
              !!(activeTabId !== tab.id && filteredTabIds?.includes(tab.id))
            }
            count={counts?.[tab.id]}
            showCounts={showCounts}
            isCompact={isCompact}
            onPress={handleTabPress}
            testID={`${testIDPrefix}-${tab.id}`}
            onLayout={(e: LayoutChangeEvent) => onItemLayout(tab.id, e)}
          />
        ))}
        {!!actionButton && (
          <Pressable
            onPress={actionButton.disabled ? undefined : actionButton.onPress}
            testID={actionButton.testID || `${testIDPrefix}-action`}
            style={styles.tab}
            disabled={actionButton.disabled}
          >
            {!!actionButton.icon && (
              <Icon
                name={actionButton.icon}
                size={isCompact ? 14 : 16}
                tone="primary"
                library={actionButton.iconLibrary}
              />
            )}
            {!!actionButton.label && (
              <Text style={styles.tabLabel}>{actionButton.label}</Text>
            )}
          </Pressable>
        )}
      </Animated.ScrollView>
      {!!edges.left && <EdgeFade side="left" />}
      {!!edges.right && <EdgeFade side="right" />}
    </View>
  );
}

export const FilterTabs = FilterTabsComponent;

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  scrollView: {
    flexShrink: 1,
  },
  scrollContent: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing['3'],
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing['3'] + 2,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.xl,
    gap: theme.spacing.xs + 2,
    backgroundColor: theme.colors.filterTab.inactiveBg,
    variants: {
      compact: {
        true: {
          paddingHorizontal: theme.spacing.sm + 2,
          paddingVertical: theme.spacing.xs + 2,
          borderRadius: theme.radii.lg,
          gap: theme.spacing.xs,
        },
      },
      actionDisabled: {
        true: { opacity: 0.4 },
      },
    },
  },
  tabLabel: {
    fontSize: theme.typography.fontSize.sm - 1,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
    variants: {
      compact: {
        true: { fontSize: theme.typography.fontSize.xs },
      },
    },
  },
}));
