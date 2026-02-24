import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useAppStore } from '#store/useAppStore';
import { Icon } from '#utils/iconUtils';

/**
 * Persistent banner displayed when the app is offline.
 *
 * Renders a slim warning bar at the top of the screen so users
 * know their actions are being queued locally rather than synced.
 *
 * Place inside the SafeAreaView, above the navigation tree.
 */
export const OfflineBanner: React.FC = () => {
  const isOnline = useAppStore(state => state.isOnline);

  if (isOnline) return null;

  return (
    <View style={styles.container} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icon name="cloud-offline-outline" size={16} color={styles.text.color} />
      <Text maxFontSizeMultiplier={1.5} style={styles.text}>
        You're offline — changes will sync when reconnected
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
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.alertBanner.warning.text,
  },
}));
