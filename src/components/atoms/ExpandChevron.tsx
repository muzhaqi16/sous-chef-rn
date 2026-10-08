import React, { useLayoutEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Icon, type IconTone } from '#/utils/iconUtils';
import { motion } from '#/theme/foundations/motion';

interface ExpandChevronProps {
  expanded: boolean;
  size?: number;
  /** Default `textSecondary`. */
  tone?: IconTone;
}

/** A chevron that turns to point up while what it opens is open. */
export const ExpandChevron: React.FC<ExpandChevronProps> = ({
  expanded,
  size = 20,
  tone = 'textSecondary',
}) => {
  const rotation = useSharedValue(expanded ? 180 : 0);

  useLayoutEffect(() => {
    rotation.set(withSpring(expanded ? 180 : 0, motion.spring.EXPAND));
  }, [expanded, rotation]);

  const turned = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));

  return (
    <Animated.View style={turned}>
      <Icon name="chevron-down" size={size} tone={tone} />
    </Animated.View>
  );
};
