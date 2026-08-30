import React from 'react';
import { View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { TIMING } from '#constants/animations';
import { PantryItemSkeleton } from '#features/pantry/components/skeletons/PantryItemSkeleton';
import { PantryStickyTabs } from './pantryDisplay/PantryStickyTabs';

// A screenful is enough: the flap only covers the area below the header, and
// each shimmer is a UI-thread animation running during the row-mount window.
const SKELETON_ROWS = 8;

/**
 * Covers the list area while FlashList's first layout is pending: v2 holds every
 * cell at `opacity: 0` until it commits, while the header chrome paints at once.
 * It must exist from the list's FIRST commit — anything mounting on a post-commit
 * state update is starved behind the row-mount storm it covers.
 */

// Absolute inside `ListHeaderComponent`, and no zIndex deliberately: cells are a
// later sibling, so they paint over it the instant they turn opaque. Must sit
// inside `PantryStickyTabsProvider`.
export const PantryListSkeletonOverlay: React.FC = () => (
  <Animated.View
    testID="pantry-list-skeleton-overlay"
    exiting={FadeOut.duration(TIMING.STANDARD)}
    style={styles.flap}
    pointerEvents="none"
  >
    <PantryStickyTabs pinned={false} />
    <View style={styles.rows}>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <PantryItemSkeleton key={index} />
      ))}
    </View>
  </Animated.View>
);

const styles = StyleSheet.create((theme, rt) => ({
  flap: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    height: rt.screen.height,
    backgroundColor: theme.colors.background,
  },
  rows: {
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
}));
