import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useIsEffectivelyOffline } from '#hooks/settings/useOfflineMode';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

interface OfflineGateProps {
  children: React.ReactNode;
  message?: string;
  description?: string;
  /** `'replace'` swaps in the message, `'hide'` renders nothing. */
  mode?: 'replace' | 'hide';
  /** Single-line display. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Gates network-dependent content on `useIsEffectivelyOffline` (device offline OR offline mode on). */
export const OfflineGate: React.FC<OfflineGateProps> = ({
  children,
  message = 'Not available offline',
  description,
  mode = 'replace',
  compact = false,
  style,
}) => {
  const isOffline = useIsEffectivelyOffline();

  if (!isOffline) {
    return <>{children}</>;
  }

  if (mode === 'hide') {
    return null;
  }

  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        <Icon name="cloud-offline-outline" size={16} />
        <Text role="caption" tone="secondary">
          {message}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Icon name="cloud-offline-outline" size={48} />
      <Text role="heading" tone="secondary" align="center">
        {message}
      </Text>
      {description ? (
        <Text
          role="caption"
          tone="secondary"
          align="center"
          style={styles.description}
        >
          {description}
        </Text>
      ) : null}
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
  description: {},
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
}));
