import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from '#components/atoms/themedComponents';
import { useOfflineStatus } from '#hooks/ui/useOfflineStatus';
import { toastService } from '#/services/toastService';
import { TOAST } from '#/constants/animations';
import { Text } from '#components/atoms/Text';
import { Icon } from '#components/atoms/Icon';
import { kitTestIDs } from '#components/testIDs';
import { hitSlop } from '#/theme/foundations/sizes';
import { motion } from '#/theme/motion';

interface OfflineStatusPillProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Inline offline indicator for a header's action row; renders nothing online.
 * Purely visual so it can be mounted in every header: a screen reader hears
 * the transition once, from `OfflineTransitionAnnouncer` at the app root.
 */
export const OfflineStatusPill: React.FC<OfflineStatusPillProps> = ({
  size = 22,
  style,
}) => {
  const { offline, iconName, title, detail, message, pendingCount } =
    useOfflineStatus();

  if (!offline) return null;

  const handlePress = () => {
    toastService.warning(title, { detail, duration: TOAST.AUTO_DISMISS_LONG });
  };

  return (
    <Animated.View
      entering={FadeIn.duration(motion.timing.STANDARD)}
      exiting={FadeOut.duration(motion.timing.STANDARD)}
    >
      <Pressable
        testID={kitTestIDs.offlineBanner}
        onPress={handlePress}
        style={[styles.pressable, style]}
        hitSlop={hitSlop.md}
        accessibilityRole="button"
        accessibilityLabel={message}
      >
        <Icon name={iconName} size={size} tone="alertBannerWarning" />
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text role="footnoteStrong" style={styles.badgeText}>
              {pendingCount > 9 ? '9+' : pendingCount}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  // The same action box every header button gets: without it the pill sits
  // flush against the header's edge and the badge overflows the screen.
  pressable: {
    position: 'relative',
    padding: theme.spacing.xs,
    minWidth: theme.sizes.touchTarget.md,
    minHeight: theme.sizes.touchTarget.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    // Anchored on the action box's corner, as the header's own badge is.
    top: -theme.spacing.xs,
    right: -theme.spacing.xs,
    minWidth: theme.spacing.mdPlus,
    minHeight: theme.spacing.mdPlus,
    paddingVertical: 0,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.warning,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.background,
  },
  badgeText: {
    color: theme.colors.onWarning,
  },
}));
