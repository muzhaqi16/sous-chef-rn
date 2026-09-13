import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from '#components/atoms/themedComponents';
import { useOfflineStatus } from '#hooks/app/useOfflineStatus';
import { toastService } from '#/services/toastService';
import { TOAST } from '#/constants/animations';
import { Text } from '#components/atoms/Text';
import { Icon } from '#utils/iconUtils';

interface OfflineStatusPillProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Inline offline indicator for a header's action row; renders nothing online.
 * Purely visual so it can be mounted in every header — the on/off announcement
 * toast fires once at the app root in `OfflineTransitionToaster`, not here.
 */
export const OfflineStatusPill: React.FC<OfflineStatusPillProps> = ({
  size = 22,
  style,
}) => {
  const { offline, iconName, message, pendingCount } = useOfflineStatus();

  if (!offline) return null;

  const handlePress = () => {
    toastService.warning(message, { duration: TOAST.AUTO_DISMISS_LONG });
  };

  return (
    <Pressable
      testID="offline-banner"
      onPress={handlePress}
      style={[styles.pressable, style]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
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
    color: theme.colors.textInverse,
  },
}));
