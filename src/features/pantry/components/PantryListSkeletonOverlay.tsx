import { pantryTestIDs } from '#features/pantry/testIDs';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { PantryItemSkeleton } from '#features/pantry/components/skeletons/PantryItemSkeleton';
import { motion } from '#/theme/foundations/motion';

// A screenful is enough, and each shimmer is a UI-thread animation running
// during the row-mount window.
const SKELETON_ROWS = 8;

/**
 * Covers the list area while FlashList's first layout is pending: v2 holds every
 * cell at `opacity: 0` until it commits, while the chrome above paints at once.
 * It must exist from the list's FIRST commit — anything mounting on a post-commit
 * state update is starved behind the row-mount storm it covers.
 */
export const PantryListSkeletonOverlay: React.FC<{
  style?: StyleProp<ViewStyle>;
}> = ({ style }) => (
  <Animated.View
    testID={pantryTestIDs.listSkeletonOverlay}
    exiting={FadeOut.duration(motion.timing.STANDARD)}
    style={[styles.cover, style]}
    pointerEvents="none"
  >
    {Array.from({ length: SKELETON_ROWS }, (_, index) => (
      <PantryItemSkeleton key={index} />
    ))}
  </Animated.View>
);

const styles = StyleSheet.create(theme => ({
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
  },
}));
