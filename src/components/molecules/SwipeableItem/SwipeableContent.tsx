import React from 'react';
import { useTranslation } from '#/i18n';
import {
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
// RNGH's Pressable (not the themed RN re-export). This is the draggable card
// surface inside RNGH's Swipeable; RN's Pressable doesn't register with RNGH's
// gesture system, so under v3 it captures the touch and the swipe pan never
// activates. Matches SwipeActionButton, which uses RNGH's Pressable for the
// same reason.
import { Pressable } from 'react-native-gesture-handler';
import { RIPPLE } from '#constants/ripple';

interface SwipeableContentProps {
  children: React.ReactNode;
  /** Identifies the row itself. Detox recommends matching by id rather than by
   *  text — text matchers are locale-dependent and, once a list is filtered by
   *  the same string, collide with the search field. */
  testID?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Swipe actions exposed to screen readers, which cannot swipe. Hosted here
   *  rather than on a wrapper view around Swipeable — this container already
   *  exists, so the row costs one view fewer. */
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
}

export const SwipeableContent: React.FC<SwipeableContentProps> = ({
  children,
  testID,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityActions,
  onAccessibilityAction,
}) => {
  const { t } = useTranslation();
  return (
    <View
      style={styles.itemContainer}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
    >
      <Pressable
        testID={testID}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={150}
        style={styles.touchable}
        android_ripple={RIPPLE.SUBTLE}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint || t('a11y.swipeForActions')}
      >
        {children}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  itemContainer: {
    flex: 1,
  },
  touchable: {
    // flex: 1 removed to prevent blocking swipe action buttons

    // Matches the card's own radius (`BaseItemCard.container`) so the Android
    // ripple is masked to the row's rounded shape. `android_ripple` with
    // `borderless: false` is clipped to the pressed view's background shape,
    // and this view had none — so every press painted a square-cornered grey
    // rectangle behind a rounded card, out past its corners.
    //
    // Radius only, deliberately no `overflow: 'hidden'`: the card draws a soft
    // drop shadow that extends past its bounds, and clipping here would cut it
    // to a hard rectangle — the same reason `childrenContainer` stays visible.
    borderRadius: theme.radii.xl,
  },
}));
