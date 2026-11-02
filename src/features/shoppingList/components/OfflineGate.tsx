import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';

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

/** Gates network-dependent content on the server being reachable. */
export const OfflineGate: React.FC<OfflineGateProps> = ({
  children,
  message,
  description,
  mode = 'replace',
  compact = false,
  style,
}) => {
  const { t } = useTranslation();
  const isOffline = useIsApiUnavailable();

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
          {message ?? t('errors.notAvailableOffline')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Icon name="cloud-offline-outline" size={48} />
      <Text role="heading" tone="secondary" align="center">
        {message ?? t('errors.notAvailableOffline')}
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
