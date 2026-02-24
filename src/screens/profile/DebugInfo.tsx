import React, { useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { Environment } from '#/utils/environment';
import Config from 'react-native-config';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Clipboard from '@react-native-clipboard/clipboard';

export const DebugInfo: React.FC = () => {
  const config = Environment.getConfig();
  const apiConfig = Environment.getApiConfig();

  // Get actual API URL being used
  const actualApiUrl = Config.API_URL || apiConfig.baseUrl;
  const actualWsUrl = Config.WEB_SOCKET_URL || apiConfig.wsUrl;

  const debugData = useMemo(() => ({
    'Environment': {
      'Build Mode': config.buildMode,
      'Is Development': config.isDevelopment ? 'Yes' : 'No',
      'Is Staging': config.isStaging ? 'Yes' : 'No',
      'Is Production': config.isProduction ? 'Yes' : 'No',
      'Is Testing': config.isTesting ? 'Yes' : 'No',
    },
    'API Configuration': {
      'API URL': actualApiUrl,
      'WebSocket URL': actualWsUrl,
      'API Key': Config.API_KEY ? `${Config.API_KEY.substring(0, 20)}...` : 'Not set',
      'Timeout': `${apiConfig.timeout}ms`,
      'Max Retries': apiConfig.retries.toString(),
    },
    'Telemetry': {
      'Prometheus Endpoint': Config.PROMETHEUS_ENDPOINT || 'Not set',
      'Loki Endpoint': Config.LOKI_ENDPOINT || 'Not set',
      'Auth Username': Config.TELEMETRY_AUTH_USERNAME || 'Not set',
    },
    'Device Info': {
      'Platform': Platform.OS,
      'Version': Platform.Version.toString(),
      'App Version': DeviceInfo.getVersion(),
      'Build Number': DeviceInfo.getBuildNumber(),
      'Bundle ID': DeviceInfo.getBundleId(),
      'Device Brand': DeviceInfo.getBrand(),
      'Device Model': DeviceInfo.getModel(),
    },
    'Build Configuration': {
      'NODE_ENV': Config.NODE_ENV || 'Not set',
      'Web App URL': Config.WEB_APP_URL || 'Not set',
    },
  }), [config, apiConfig, actualApiUrl, actualWsUrl]);

  const handleCopyAll = useCallback(() => {
    const allDebugInfo = Object.entries(debugData)
      .map(([section, data]) => {
        const items = Object.entries(data)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');
        return `=== ${section} ===\n${items}`;
      })
      .join('\n\n');

    Clipboard.setString(allDebugInfo);
    Alert.alert('Copied', 'Debug information copied to clipboard');
  }, [debugData]);

  const handleCopySection = useCallback((sectionName: string, data: Record<string, string>) => {
    const sectionInfo = Object.entries(data)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    Clipboard.setString(sectionInfo);
    Alert.alert('Copied', `${sectionName} copied to clipboard`);
  }, []);

  // Only show in development, local, or staging builds
  if (!Environment.shouldEnableDebugFeatures()) {
    return (
      <ProfileScreenWrapper title="Debug Info">
        <View style={styles.notAvailableContainer}>
          <Text style={styles.notAvailableText}>
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
          <Text style={styles.headerText}>
            Detailed debug information for troubleshooting API connections and app configuration.
          </Text>
          <Pressable style={({pressed}) => [styles.copyAllButton, pressed && styles.pressed]} onPress={handleCopyAll}>
            <Text style={styles.copyAllButtonText}>Copy All Info</Text>
          </Pressable>
        </View>

        {Object.entries(debugData).map(([sectionName, sectionData]) => (
          <View key={sectionName} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{sectionName}</Text>
              <Pressable
                style={({pressed}) => [styles.copySectionButton, pressed && styles.pressed]}
                onPress={() => handleCopySection(sectionName, sectionData)}
              >
                <Text style={styles.copySectionButtonText}>Copy</Text>
              </Pressable>
            </View>
            <View style={styles.infoContainer}>
              {Object.entries(sectionData).map(([key, value]) => (
                <View key={key} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{key}</Text>
                  <Text style={styles.infoValue} selectable>
                    {value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This information is useful when debugging API connection issues or reporting bugs.
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
  notAvailableText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  header: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing['3'],
    lineHeight: theme.typography.lineHeight.normal,
  },
  copyAllButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
  },
  copyAllButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.semibold,
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
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  copySectionButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing['3'],
    borderRadius: theme.radii.xs + 2,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  copySectionButtonText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
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
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footer: {
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  footerText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default DebugInfo;
