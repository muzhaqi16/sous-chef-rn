import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useIsOnline } from '#store/useAppStore';
import { useIsOfflineBannerVisible } from '#hooks/app/useIsOfflineBannerVisible';
import { Text } from '#components/atoms/Text';

// The banner icon matches the warning text color, which differs between light
// and dark themes. `<Icon tone>` only exposes flat top-level theme colors, not
// the nested `alertBanner.warning.text` path, so wrap Ionicons directly with
// withUnistyles — it re-resolves the color on theme change so the icon stays
// in sync with the text instead of going stale until a remount.
const BannerIcon = withUnistyles(Ionicons, theme => ({
  color: theme.colors.alertBanner.warning.text,
}));

/**
 * Persistent banner displayed when the app is offline.
 *
 * Renders a slim warning bar at the top of the screen so users
 * know their actions are being queued locally rather than synced.
 *
 * Rendered as the first child of the app root (above the navigation tree). It
 * carries its own top safe-area inset — an app-background strip above the
 * warning bar — so the status-bar area stays app-colored while the banner sits
 * just below it. `OfflineBannerInsetProvider` re-publishes the insets with
 * `top: 0` for the subtree below, so nothing under the banner double-insets.
 */
export const OfflineBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const isOnline = useIsOnline();
  const visible = useIsOfflineBannerVisible();

  if (!visible) return null;

  const isDeviceOffline = !isOnline;
  const iconName = isDeviceOffline
    ? 'cloud-offline-outline'
    : 'airplane-outline';
  const message = isDeviceOffline
    ? "You're offline — changes will sync when reconnected"
    : 'Offline mode enabled — using cached data only';

  return (
    <View style={[styles.insetWrap, { paddingTop: insets.top }]}>
      <View
        style={styles.container}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <BannerIcon name={iconName} size={16} />
        <Text
          size="xs"
          weight="medium"
          maxFontSizeMultiplier={1.5}
          style={styles.text}
        >
          {message}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  insetWrap: {
    backgroundColor: theme.colors.background,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.alertBanner.warning.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.alertBanner.warning.border,
  },
  text: {
    color: theme.colors.alertBanner.warning.text,
  },
}));
