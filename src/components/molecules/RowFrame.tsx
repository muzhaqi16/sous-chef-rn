import React from 'react';
import {
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
// RNGH's Pressable for a swipe row's surface: inside RNGH's Swipeable an RN one
// takes the touch, and the swipe pan never starts.
import { Pressable as GesturePressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { RIPPLE } from '#constants/ripple';
import { GestureRowProvider } from '#context/GestureRowContext';
import { commonStyles } from '#styles/commonStyles';

/**
 * The press a swipe row's surface takes, from `SwipeableItem`: RNGH's button,
 * with the row's swipe actions as accessibility actions, since a screen reader
 * cannot swipe.
 */
export interface SwipeRowPress {
  onPress?: () => void;
  onLongPress?: () => void;
  testID?: string;
  accessibilityLabel: string;
  accessibilityHint: string;
  accessibilityActions: AccessibilityActionInfo[];
  onAccessibilityAction: (event: AccessibilityActionEvent) => void;
}

/** What tapping a row that does not swipe does, and how it is announced. */
export interface RowPress {
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  haptic?: boolean;
  ripple?: boolean;
  testID?: string;
}

interface RowFrameProps {
  /** A control before the row's text, such as a checkbox. */
  leading?: React.ReactNode;
  /** Controls after the row's text. */
  trailing?: React.ReactNode;
  /** From `SwipeableItem`: the surface is RNGH's button. */
  swipe?: SwipeRowPress;
  press?: RowPress;
  /** A row with nothing to press still reads as one element. */
  accessibilityLabel?: string;
  surfaceStyle?: StyleProp<ViewStyle>;
  /** On the row's content, for a row that presses nothing. */
  testID?: string;
  children: React.ReactNode;
}

/**
 * A list row: its press surface, and the controls beside it. A control is never
 * inside the surface, which is one accessible element and, in a swipe row,
 * RNGH's button: either one swallows a control nested in it, for a tap and for
 * a screen reader alike. The surface reaches the row's edge on a side with no
 * control, so the whole row presses.
 */
export const RowFrame: React.FC<RowFrameProps> = ({
  leading,
  trailing,
  swipe,
  press,
  accessibilityLabel,
  surfaceStyle,
  testID,
  children,
}) => {
  const surface = [
    styles.surface,
    !leading && styles.surfaceLeadInset,
    !trailing && styles.surfaceTrailInset,
  ];

  const pressSurface = swipe ? (
    <GesturePressable
      style={surface}
      testID={swipe.testID}
      onPress={swipe.onPress}
      onLongPress={swipe.onLongPress}
      delayLongPress={150}
      android_ripple={RIPPLE.SUBTLE}
      accessibilityRole={swipe.onPress ? 'button' : undefined}
      accessibilityLabel={swipe.accessibilityLabel}
      accessibilityHint={swipe.accessibilityHint}
      accessibilityActions={swipe.accessibilityActions}
      onAccessibilityAction={swipe.onAccessibilityAction}
    >
      {children}
    </GesturePressable>
  ) : press ? (
    <AppPressable
      style={surface}
      testID={press.testID}
      onPress={press.onPress}
      onLongPress={press.onLongPress}
      delayLongPress={press.onLongPress ? 500 : undefined}
      haptic={press.haptic}
      ripple={press.ripple}
      accessibilityRole="button"
      accessibilityLabel={press.accessibilityLabel}
      accessibilityHint={press.accessibilityHint}
      accessibilityState={press.accessibilityState}
      accessibilityActions={press.accessibilityActions}
      onAccessibilityAction={press.onAccessibilityAction}
    >
      {children}
    </AppPressable>
  ) : (
    <View
      style={surface}
      testID={testID}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </View>
  );

  const row = (
    <View style={[commonStyles.rowSurface, surfaceStyle]}>
      <View style={[commonStyles.rowContent, styles.frame]}>
        {!!leading && <View style={styles.leading}>{leading}</View>}
        {pressSurface}
        {!!trailing && <View style={styles.trailing}>{trailing}</View>}
      </View>
    </View>
  );

  return swipe ? <GestureRowProvider value>{row}</GestureRowProvider> : row;
};

const styles = StyleSheet.create(theme => ({
  // The row's insets move onto its parts, so the surface can reach an edge.
  frame: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  surface: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.layout.rowSlotGap,
    paddingVertical: theme.layout.rowInset,
  },
  surfaceLeadInset: {
    paddingLeft: theme.layout.rowInsetHorizontal,
  },
  surfaceTrailInset: {
    paddingRight: theme.layout.rowInsetHorizontal,
  },
  leading: {
    justifyContent: 'center',
    // Never compressed when the row has no image.
    flexShrink: 0,
    paddingLeft: theme.layout.rowInsetHorizontal,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.layout.rowSlotGap,
    paddingRight: theme.layout.rowInsetHorizontal,
  },
}));
