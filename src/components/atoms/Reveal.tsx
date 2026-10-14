import React, { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated, {
  type CSSTransitionProperties,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { motion } from '#/theme/foundations/motion';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';
import { ThemeEpochSentinel } from '#components/atoms/ThemeEpochSentinel';

// Attached from the container's first commit: a transition attached in the
// commit that changes the height animates nothing.
// Verified: #reanimated-css-transitions-need-a-baseline-commit.
const SLIDE: CSSTransitionProperties = {
  transitionProperty: ['height', 'opacity'],
  transitionDuration: motion.timing.STANDARD,
  transitionTimingFunction: motion.cssEasing.standard,
};

// Plain values, not a Unistyles style: the transition animates what the style
// prop carries, and a Unistyles style hands its values to the native side.
const sized = (height: number | undefined, open: boolean): ViewStyle => ({
  height,
  opacity: open ? 1 : 0,
});

interface RevealProps {
  open: boolean;
  children: React.ReactNode;
}

/**
 * Slides its content open and shut, and follows it when it grows. The height
 * is a style prop with a transition, so what follows moves with it and a React
 * commit cannot reset it. Content open from the first render shows at once.
 * Spacing goes inside, so it slides too.
 */
export const Reveal: React.FC<RevealProps> = ({ open, children }) => {
  // Reanimated's CSS transitions ignore reduce motion.
  // Verified: #reanimated-css-transitions-ignore-reduce-motion.
  const motionEnabled = useMotionEnabled();
  const [startedOpen] = useState(open);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  // Laid-out content stays through the close, so it shrinks away rather than
  // vanishing; the close's timer releases it.
  const [laidOut, setLaidOut] = useState(open);

  useEffect(() => {
    if (open) return undefined;
    const timer = setTimeout(() => setLaidOut(false), motion.timing.STANDARD);
    return () => clearTimeout(timer);
  }, [open]);

  const measure = ({ nativeEvent }: LayoutChangeEvent) => {
    const { height } = nativeEvent.layout;
    setContentHeight(prev => (prev === height ? prev : height));
    setLaidOut(true);
  };

  // Unmeasured, content open from the start takes its own height; content
  // opened later grows from none.
  const openHeight = contentHeight ?? (startedOpen ? undefined : 0);
  // Inside the sized container the content would measure at its height; out
  // of the flow it measures at its own.
  const sizing = openHeight === undefined ? undefined : styles.measured;

  return (
    <Animated.View
      style={[
        styles.clip,
        sized(open ? openHeight : 0, open),
        motionEnabled ? SLIDE : null,
      ]}
      pointerEvents={open ? 'auto' : 'none'}
    >
      {open || laidOut ? (
        <View style={sizing} onLayout={measure}>
          {children}
        </View>
      ) : null}
      <ThemeEpochSentinel />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  measured: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
