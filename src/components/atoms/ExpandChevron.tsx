import React from 'react';
import type { ViewStyle } from 'react-native';
import Animated, {
  type CSSTransitionProperties,
} from 'react-native-reanimated';
import { Icon, type IconTone, type IconSizeName } from '#components/atoms/Icon';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';
import { motion } from '#theme/motion';

const POINTS_DOWN: ViewStyle = { transform: [{ rotate: '0deg' }] };
const POINTS_UP: ViewStyle = { transform: [{ rotate: '180deg' }] };

const TURN: CSSTransitionProperties = {
  transitionProperty: 'transform',
  transitionDuration: motion.timing.STANDARD,
  transitionTimingFunction: motion.cssEasing.standard,
};

interface ExpandChevronProps {
  expanded: boolean;
  size?: IconSizeName;
  /** Default `textSecondary`. */
  tone?: IconTone;
}

/** A chevron that turns to point up while what it opens is open. */
export const ExpandChevron: React.FC<ExpandChevronProps> = ({
  expanded,
  size = 'sm',
  tone = 'textSecondary',
}) => {
  // Reanimated's CSS transitions ignore reduce motion.
  // Verified: #reanimated-css-transitions-ignore-reduce-motion.
  const motionEnabled = useMotionEnabled();
  return (
    <Animated.View
      style={[expanded ? POINTS_UP : POINTS_DOWN, motionEnabled ? TURN : null]}
    >
      <Icon name="chevron-down" size={size} tone={tone} />
    </Animated.View>
  );
};
