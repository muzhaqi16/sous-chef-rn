import React from 'react';
import { View, ScrollView } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { StyleSheet } from 'react-native-unistyles';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { Environment } from '#/utils/environment';
import Config from 'react-native-config';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Clipboard from '@react-native-clipboard/clipboard';
import { useCanAccessDevTools } from '#store/useAppStore';
import { Text } from '#components/atoms/Text';

export const DebugInfo: React.FC = () => {
  const canAccessDevTools = useCanAccessDevTools();
  const config = Environment.getConfig();
  const apiConfig = Environment.getApiConfig();

  // Get actual API URL being used
  const actualApiUrl = Config.API_URL || apiConfig.baseUrl;
  const actualWsUrl = Config.WEB_SOCKET_URL || apiConfig.wsUrl;

  const debugData = {
    Environment: {
      'Build Mode': config.buildMode,
      'Is Development': config.isDevelopment ? 'Yes' : 'No',
      'Is Staging': config.isStaging ? 'Yes' : 'No',
      'Is Production': config.isProduction ? 'Yes' : 'No',
      'Is Testing': config.isTesting ? 'Yes' : 'No',
    },
    'API Configuration': {
      'API URL': actualApiUrl,
      'WebSocket URL': actualWsUrl,
      'API Key': Config.API_KEY
        ? `${Config.API_KEY.substring(0, 20)}...`
        : 'Not set',
      Timeout: `${apiConfig.timeout}ms`,
      'Max Retries': apiConfig.retries.toString(),
    },
    Telemetry: {
      'Metrics Endpoint': Config.OTLP_METRICS_ENDPOINT || 'Not set',
      'Logs Endpoint': Config.OTLP_LOGS_ENDPOINT || 'Not set',
      'Metrics Auth': Config.OTLP_METRICS_AUTH_USERNAME || 'Not set',
      'Logs Auth': Config.OTLP_LOGS_AUTH_USERNAME || 'Not set',
    },
    'Device Info': {
      Platform: Platform.OS,
      Version: Platform.Version.toString(),
      'App Version': DeviceInfo.getVersion(),
      'Build Number': DeviceInfo.getBuildNumber(),
      'Bundle ID': DeviceInfo.getBundleId(),
      'Device Brand': DeviceInfo.getBrand(),
      'Device Model': DeviceInfo.getModel(),
    },
    'Build Configuration': {
      NODE_ENV: Config.NODE_ENV || 'Not set',
      'Web App URL': Config.WEB_APP_URL || 'Not set',
    },
  };

  const handleCopyAll = () => {
    const allDebugInfo = Object.entries(debugData)
      .map(([section, data]) => {
        const items = Object.entries(data)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');
        return `=== ${section} ===\n${items}`;
      })
      .join('\n\n');

    Clipboard.setString(allDebugInfo);
    alertService.alert('Copied', 'Debug information copied to clipboard');
  };

  const handleCopySection = (
    sectionName: string,
    data: Record<string, string>,
  ) => {
    const sectionInfo = Object.entries(data)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    Clipboard.setString(sectionInfo);
    alertService.alert('Copied', `${sectionName} copied to clipboard`);
  };

  // Only show in development, local, or staging builds — or for users with dev tools access
  if (!Environment.shouldEnableDebugFeatures() && !canAccessDevTools) {
    return (
      <ProfileScreenWrapper title="Debug Info">
        <View style={styles.notAvailableContainer}>
          <Text size="md" tone="secondary" align="center">
            Debug info is only available in development and staging builds.
          </Text>
        </View>
      </ProfileScreenWrapper>
    );
  }

  return (
    <ProfileScreenWrapper title="Debug Info">
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text
            size="sm"
            tone="secondary"
            lineHeight="normal"
            style={styles.headerText}
          >
            Detailed debug information for troubleshooting API connections and
            app configuration.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.copyAllButton,
              pressed && styles.pressed,
            ]}
            onPress={handleCopyAll}
          >
            <Text size="sm" weight="semibold" style={styles.copyAllButtonText}>
              Copy All Info
            </Text>
          </Pressable>
        </View>

        {Object.entries(debugData).map(([sectionName, sectionData]) => (
          <View key={sectionName} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text size="lg" weight="semibold">
                {sectionName}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.copySectionButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => handleCopySection(sectionName, sectionData)}
              >
                <Text size="xs" weight="semibold" tone="accent">
                  Copy
                </Text>
              </Pressable>
            </View>
            <View style={styles.infoContainer}>
              {Object.entries(sectionData).map(([key, value]) => (
                <View key={key} style={styles.infoRow}>
                  <Text
                    size="xs"
                    weight="semibold"
                    tone="secondary"
                    style={styles.infoLabel}
                  >
                    {key}
                  </Text>
                  <Text size="sm" style={styles.infoValue} selectable>
                    {value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text
            size="xs"
            tone="secondary"
            align="center"
            style={styles.footerText}
          >
            This information is useful when debugging API connection issues or
            reporting bugs.
          </Text>
        </View>
      </ScrollView>
    </ProfileScreenWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  notAvailableContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  header: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerText: {
    marginBottom: theme.spacing['3'],
  },
  copyAllButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
  },
  copyAllButtonText: {
    color: theme.colors.white,
  },
  section: {
    marginVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  copySectionButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing['3'],
    borderRadius: theme.radii.xs + 2,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  infoContainer: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  infoRow: {
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoLabel: {
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footer: {
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  footerText: {
    fontStyle: 'italic',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default DebugInfo;
