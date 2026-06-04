import { useRef, useEffect, useState } from 'react';
import { View, type LayoutChangeEvent, ScrollView } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FilterTabsItem } from './FilterTabsItem';
import type { FilterTabConfig, FilterTabsProps } from './types';
import { Text } from '#components/atoms/Text';

// ── Module-level caches for tab layout measurements ──
// Shared between the regular and sticky-header instances of the same FilterTabs
// so the sticky copy can start at the correct scroll offset without flicker.
const tabLayoutCache = new Map<
  string,
  Map<string, { x: number; width: number }>
>();
const viewportWidthCache = new Map<string, number>();

function computeScrollOffset(activeTabId: string, cacheKey: string): number {
  const layouts = tabLayoutCache.get(cacheKey);
  const vpWidth = viewportWidthCache.get(cacheKey);
  if (!layouts || !vpWidth) return 0;
  const pos = layouts.get(activeTabId);
  if (!pos) return 0;
  return Math.max(0, pos.x - vpWidth / 2 + pos.width / 2);
}

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
  // ── Auto-scroll to keep active tab visible ──
  const scrollViewRef = useRef<ScrollView>(null);
  // Gates the centering animation: the first positioning (mount) is instant so
  // the strip doesn't visibly scroll when the screen appears; subsequent
  // activeTabId changes (user taps a tab) slide smoothly to center.
  const hasAutoCenteredRef = useRef(false);
  const cacheKey = testIDPrefix;

  // Compute initial content offset from cache to avoid flicker on sticky header mount.
  // useState initializer runs once per instance — the sticky copy gets the cached offset
  // from the regular instance, so the ScrollView starts at the right position immediately.
  const [initialContentOffset] = useState(() => ({
    x: computeScrollOffset(activeTabId, cacheKey),
    y: 0,
  }));

  // Scroll to active tab on mount and when activeTabId changes
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const offset = computeScrollOffset(activeTabId, cacheKey);
      scrollViewRef.current?.scrollTo({
        x: offset,
        animated: hasAutoCenteredRef.current,
      });
      hasAutoCenteredRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [activeTabId, cacheKey]);

  const handleScrollViewLayout = (e: LayoutChangeEvent) => {
    viewportWidthCache.set(cacheKey, e.nativeEvent.layout.width);
  };

  const handleTabLayout = (tabId: T, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    let cached = tabLayoutCache.get(cacheKey);
    if (!cached) {
      cached = new Map();
      tabLayoutCache.set(cacheKey, cached);
    }
    cached.set(tabId, { x, width });
    // On initial mount, scroll as soon as the active tab's position is known
    if (tabId === activeTabId) {
      const offset = computeScrollOffset(activeTabId, cacheKey);
      if (offset > 0) {
        scrollViewRef.current?.scrollTo({ x: offset, animated: false });
      }
    }
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
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
        onLayout={handleScrollViewLayout}
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
            onLayout={(e: LayoutChangeEvent) => handleTabLayout(tab.id, e)}
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
      </ScrollView>
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
