import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useAppStore, useIsOnline } from '#store/useAppStore';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

/**
 * Persistent banner displayed when the app is offline.
 *
 * Renders a slim warning bar at the top of the screen so users
 * know their actions are being queued locally rather than synced.
 *
 * Place inside the SafeAreaView, above the navigation tree.
 */
export const OfflineBanner: React.FC = () => {
  const isOnline = useIsOnline();
  const offlineModeEnabled = useAppStore(state => state.offlineModeEnabled);

  if (isOnline && !offlineModeEnabled) return null;

  const isDeviceOffline = !isOnline;
  const iconName = isDeviceOffline
    ? 'cloud-offline-outline'
    : 'airplane-outline';
  const message = isDeviceOffline
    ? "You're offline — changes will sync when reconnected"
    : 'Offline mode enabled — using cached data only';

  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon name={iconName} size={16} color={styles.text.color} />
      <Text
        size="xs"
        weight="medium"
        maxFontSizeMultiplier={1.5}
        style={styles.text}
      >
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
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
