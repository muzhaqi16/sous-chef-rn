import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
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
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const SwipeableContent: React.FC<SwipeableContentProps> = ({
  children,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.itemContainer}>
      <Pressable
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

const styles = StyleSheet.create(() => ({
  itemContainer: {
    flex: 1,
  },
  touchable: {
    // flex: 1 removed to prevent blocking swipe action buttons
  },
}));
