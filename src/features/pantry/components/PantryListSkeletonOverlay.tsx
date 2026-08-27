import React from 'react';
import { View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { TIMING } from '#constants/animations';
import { PantryItemSkeleton } from '#features/pantry/components/skeletons/PantryItemSkeleton';
import { PantryStickyTabs } from './pantryDisplay/PantryStickyTabs';

// Viewport-fill: the flap only ever covers the area below the header, so a
// screenful is enough — fewer rows than PantryScreenSkeleton's 10 because each
// shimmer is a UI-thread animation running during the row-mount window.
const SKELETON_ROWS = 8;

/**
 * Opaque cover for the list area while FlashList's first layout is pending.
 *
 * FlashList v2 keeps every cell — the sticky FilterTabs sentinel included — at
 * `opacity: 0` until its progressive first layout commits, while the
 * `ListHeaderComponent` chrome paints immediately. Without this cover that
 * window is a header-only frame with a blank body (300 ms+ on a mid-range
 * device).
 *
 * It renders INSIDE the ListHeaderComponent wrapper, absolutely positioned at
 * `top: '100%'` — i.e. flush below the chrome — because anything whose mount
 * waits on a post-first-commit state update (a measured header height via
 * `onLayout`, a deferred flag) is starved behind exactly the JS-thread storm
 * it exists to cover; measured on device, an overlay gated on `onLayout`
 * appeared only AFTER the rows did. Absolute position keeps it out of the
 * header's measured height, so cell offsets are unaffected.
 *
 * No zIndex, deliberately: the cell container is a LATER sibling of the
 * header inside FlashList's scroll content, so the instant cells turn opaque
 * they paint over this flap — the reveal is not gated on the release state
 * update (which is starved like any other). The unmount fade only shows
 * through the small gaps between row cards. It must sit inside
 * `PantryStickyTabsProvider` (the tabs strip reads that context, so the cover
 * shows the real tabs, not a placeholder).
 *
 * `pointerEvents="none"` matches what it covers: the rows underneath are
 * mounted-but-transparent and already receive touches today.
 */
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
