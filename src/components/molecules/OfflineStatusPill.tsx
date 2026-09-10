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
          <Text role="label" style={styles.badgeText}>
            {pendingCount > 9 ? '9+' : pendingCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  pressable: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.warning,
    borderWidth: theme.borderWidth.medium,
    borderColor: theme.colors.background,
  },
  badgeText: {
    color: theme.colors.textInverse,
  },
}));
