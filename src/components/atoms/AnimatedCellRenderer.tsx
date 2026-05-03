import React from 'react';
import Animated from 'react-native-reanimated';
import type { ViewProps } from 'react-native';

/**
 * Reanimated-compatible cell renderer for FlashList.
 * @see https://shopify.github.io/flash-list/docs/guides/reanimated
 */
const AnimatedCellRenderer = React.forwardRef<
  React.ComponentRef<typeof Animated.View>,
  ViewProps & { index?: number }
>(({ index: _index, ...props }, ref) => <Animated.View ref={ref} {...props} />);

export { AnimatedCellRenderer };
