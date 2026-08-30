import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Pressable } from '#components/atoms/themedComponents';
import { useOfflineStatus } from '#hooks/app/useOfflineStatus';
import { toastService } from '#/services/toastService';
import { TOAST } from '#/constants/animations';
import { Text } from '#components/atoms/Text';

// `<Icon tone>` exposes flat top-level colors only, not the nested
// `alertBanner.warning.text` path, so wrap Ionicons directly — withUnistyles
// re-resolves the color on theme change instead of going stale until a remount.
const PillIcon = withUnistyles(Ionicons, theme => ({
  color: theme.colors.alertBanner.warning.text,
}));

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
      <PillIcon name={iconName} size={size} />
      {pendingCount > 0 && (
        <View style={styles.badge}>
          <Text
            size="2xs"
            weight="bold"
            maxFontSizeMultiplier={1.3}
            style={styles.badgeText}
          >
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
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  badgeText: {
    color: theme.colors.textInverse,
    lineHeight: 13,
  },
}));
