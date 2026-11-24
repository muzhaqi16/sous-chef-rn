import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type CSSTransitionProperties,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useAnimatedTheme } from '#hooks/ui/useAnimatedTheme';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';
import { createValueContext } from '#hooks/utils/createValueContext';
import { motion } from '#/theme/motion';

interface RowCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * A card that lights up, such as a home just joined: the brand tint fades
   * over the whole card, and its rows draw no fill of their own so it shows.
   * Left out, the card is a plain one.
   */
  highlighted?: boolean;
}

const RowsOnCardFill = createValueContext<boolean>('RowsOnCardFill');

/** True inside a card that can light up: a row there draws no fill. */
export const useRowsOnCardFill = (): boolean =>
  RowsOnCardFill.useOptionalValue() === true;

const LIT: ViewStyle = { opacity: 1 };
const UNLIT: ViewStyle = { opacity: 0 };

const FADE: CSSTransitionProperties = {
  transitionProperty: 'opacity',
  transitionDuration: motion.timing.FAST,
  transitionTimingFunction: motion.cssEasing.gentle,
};

/** The card's brand tint, under its rows. */
const HighlightTint: React.FC<{ lit: boolean }> = ({ lit }) => {
  // Reanimated's CSS transitions ignore reduce motion.
  // Verified: #reanimated-css-transitions-ignore-reduce-motion.
  const motionEnabled = useMotionEnabled();
  const animatedTheme = useAnimatedTheme();
  // A theme-only worklet: the animated node takes no themed style.
  const tintThemeStyle = useAnimatedStyle(() => ({
    backgroundColor: animatedTheme.get().colors.primaryLight,
  }));
  return (
    <Animated.View
      style={[
        tintStyles.tint,
        tintThemeStyle,
        lit ? LIT : UNLIT,
        motionEnabled ? FADE : null,
      ]}
    />
  );
};

/**
 * One list row's card: its fill, corners and shadow, and the gap below it. The
 * inner clip rounds what the row draws under itself (a swipe tray, a press
 * ripple); a clip on the card itself would cut its own shadow off.
 */
export const RowCard: React.FC<RowCardProps> = ({
  children,
  style,
  testID,
  highlighted,
}) => (
  <View style={[styles.card, style]} testID={testID}>
    <View style={styles.clip}>
      {highlighted === undefined ? (
        children
      ) : (
        <>
          <HighlightTint lit={highlighted} />
          <RowsOnCardFill.Provider value>{children}</RowsOnCardFill.Provider>
        </>
      )}
    </View>
  </View>
);

const tintStyles = StyleSheet.create({
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
});

const styles = StyleSheet.create(theme => ({
  card: {
    marginBottom: theme.layout.rowGap,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    ...theme.shadows.card,
  },
  clip: {
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    // Keeps the row's slots inside this view. A background-only view lends its
    // children to the nearest ancestor that holds its own, and Fabric can
    // re-insert them there under this fill: the checkbox and badge vanish.
    isolation: 'isolate',
  },
}));
