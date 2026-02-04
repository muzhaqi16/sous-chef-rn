import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useIsEffectivelyOffline } from '#hooks/settings/useOfflineMode';
import { Icon } from '#utils/iconUtils';

interface OfflineGateProps {
  children: React.ReactNode;
  /** Message displayed when offline (default: "Not available offline") */
  message?: string;
  /** Optional description text */
  description?: string;
  /** How to handle offline state: 'replace' shows message, 'hide' renders nothing */
  mode?: 'replace' | 'hide';
  /** Use compact single-line display */
  compact?: boolean;
  /** Container style overrides */
  style?: StyleProp<ViewStyle>;
}

/**
 * Component that gates network-dependent features when offline.
 *
 * Shows a user-friendly offline message when the app is effectively offline
 * (either device offline or user enabled offline mode).
 *
 * @example
 * ```tsx
 * // Replace content with offline message
 * <OfflineGate message="Sharing requires internet">
 *   <SharePanel />
 * </OfflineGate>
 *
 * // Hide content when offline
 * <OfflineGate mode="hide">
 *   <SearchSuggestions />
 * </OfflineGate>
 *
 * // Compact inline message
 * <OfflineGate compact message="Search unavailable">
 *   <AutocompleteResults />
 * </OfflineGate>
 * ```
 */
export const OfflineGate: React.FC<OfflineGateProps> = ({
  children,
  message = 'Not available offline',
  description,
  mode = 'replace',
  compact = false,
  style,
}) => {
  const isOffline = useIsEffectivelyOffline();

  // When online, render children normally
  if (!isOffline) {
    return <>{children}</>;
  }

  // When offline with 'hide' mode, render nothing
  if (mode === 'hide') {
    return null;
  }

  // Compact single-line display
  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        <Icon name="cloud-offline-outline" library="Ionicons" size={16} />
        <Text style={styles.compactText}>{message}</Text>
      </View>
    );
  }

  // Full offline message display
  return (
    <View style={[styles.container, style]}>
      <Icon name="cloud-offline-outline" library="Ionicons" size={48} />
      <Text style={styles.message}>{message}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  message: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  description: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  compactText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
}));
