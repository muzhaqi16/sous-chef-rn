import React from 'react';
import { useTranslation } from '#/i18n';
import {
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
// RNGH's Pressable, not the themed RN re-export: this is the draggable surface
// inside RNGH's Swipeable, and RN's doesn't register with RNGH's gesture system,
// so under v3 it captures the touch and the swipe pan never activates.
import { Pressable } from 'react-native-gesture-handler';
import { RIPPLE } from '#constants/ripple';

interface SwipeableContentProps {
  children: React.ReactNode;
  /** Identifies the row. Text matchers are locale-dependent and collide with the
   *  search field once the list is filtered by the same string. */
  testID?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Swipe actions exposed to screen readers, which cannot swipe. Hosted on this
   *  existing container rather than a wrapper, so the row costs one view fewer. */
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
    // Matches `BaseItemCard.container`'s radius so the Android ripple is masked to
    // the row's rounded shape — `android_ripple` clips to the pressed view's
    // background shape, and without one the press paints a square grey rectangle.
    // Radius only: `overflow: 'hidden'` would cut the card's soft drop shadow to a
    // hard rectangle, the same reason `childrenContainer` stays visible.
    borderRadius: theme.radii.xl,
  },
}));
