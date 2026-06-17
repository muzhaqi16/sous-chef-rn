import { useRef, useEffect, useState } from 'react';
import {
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
} from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { EdgeFade } from '#components/atoms/EdgeFade';
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

  // ── Scroll-edge fades ──
  // Show a soft fade on whichever side has more content scrolled off, so chips
  // read as scrollable instead of hard-clipped at the viewport edge. Widths are
  // tracked in refs (written only in handlers); `edges` only re-renders when a
  // fade actually toggles on/off.
  const [edges, setEdges] = useState({ left: false, right: false });
  const layoutWRef = useRef(0);
  const contentWRef = useRef(0);
  const scrollXRef = useRef(0);
  const recomputeEdges = () => {
    // Small dead-zone so a near-edge resting position doesn't fade a pill that
    // is essentially fully visible.
    const left = scrollXRef.current > 12;
    const right =
      scrollXRef.current + layoutWRef.current < contentWRef.current - 12;
    setEdges(prev =>
      prev.left === left && prev.right === right ? prev : { left, right },
    );
  };
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollXRef.current = e.nativeEvent.contentOffset.x;
    recomputeEdges();
  };
  const handleContentSizeChange = (w: number) => {
    contentWRef.current = w;
    recomputeEdges();
  };

  // Center the active tab on mount and whenever it changes. Retries across a
  // few frames so a cache that hasn't measured yet (fresh mount, or the sticky
  // copy remounting on a filter change) still lands centered instead of giving
  // up and jumping to the start. Clamps to the real scroll range so end tabs
  // settle flush against the edge rather than over-scrolling.
  useEffect(() => {
    let cancelled = false;
    const tryCenter = (attempt: number) => {
      if (cancelled) return;
      const pos = tabLayoutCache.get(cacheKey)?.get(activeTabId);
      const vp = layoutWRef.current || viewportWidthCache.get(cacheKey) || 0;
      if (pos && vp > 0) {
        const centered = Math.max(0, pos.x - vp / 2 + pos.width / 2);
        const maxScroll =
          contentWRef.current > 0
            ? Math.max(0, contentWRef.current - vp)
            : centered;
        scrollViewRef.current?.scrollTo({
          x: Math.min(centered, maxScroll),
          animated: hasAutoCenteredRef.current,
        });
        hasAutoCenteredRef.current = true;
        return;
      }
      if (attempt < 5) {
        requestAnimationFrame(() => tryCenter(attempt + 1));
      }
    };
    requestAnimationFrame(() => tryCenter(0));
    return () => {
      cancelled = true;
    };
  }, [activeTabId, cacheKey]);

  const handleScrollViewLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    viewportWidthCache.set(cacheKey, w);
    layoutWRef.current = w;
    recomputeEdges();
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
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
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
