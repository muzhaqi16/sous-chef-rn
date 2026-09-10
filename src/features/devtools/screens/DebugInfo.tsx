import React from 'react';
import { useTranslation } from '#/i18n';
import { View, ScrollView } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { StyleSheet } from 'react-native-unistyles';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { Environment } from '#/utils/environment';
import { env } from '#/config/env';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Clipboard from '@react-native-clipboard/clipboard';
import { useCanAccessDevTools } from '#store/useAppStore';
import { Text } from '#components/atoms/Text';

export const DebugInfo: React.FC = () => {
  const { t } = useTranslation();
  const canAccessDevTools = useCanAccessDevTools();
  const config = Environment.getConfig();
  const apiConfig = Environment.getApiConfig();

  // Get actual API URL being used
  const actualApiUrl = env.API_URL || apiConfig.baseUrl;
  const actualWsUrl = env.WEB_SOCKET_URL || apiConfig.wsUrl;

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
      // Presence only. This screen is reachable by a production account with
      // dev-tools access, and everything here is copyable to the clipboard, so
      // no part of a credential appears — a prefix identifies the key too.
      'API Key': env.API_KEY ? 'Configured' : 'Not set',
      Timeout: `${apiConfig.timeout}ms`,
      'Max Retries': apiConfig.retries.toString(),
    },
    Telemetry: {
      'Metrics Endpoint': env.OTLP_METRICS_ENDPOINT || 'Not set',
      'Logs Endpoint': env.OTLP_LOGS_ENDPOINT || 'Not set',
      'Metrics Auth': env.OTLP_METRICS_AUTH_USERNAME ? 'Configured' : 'Not set',
      'Logs Auth': env.OTLP_LOGS_AUTH_USERNAME ? 'Configured' : 'Not set',
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
      NODE_ENV: env.NODE_ENV || 'Not set',
      'Web App URL': env.WEB_APP_URL || 'Not set',
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
    alertService.alert(t('labels.copied'), t('debugInfo.copiedAll'));
  };

  const handleCopySection = (
    sectionName: string,
    data: Record<string, string>,
  ) => {
    const sectionInfo = Object.entries(data)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    Clipboard.setString(sectionInfo);
    alertService.alert(
      t('labels.copied'),
      t('debugInfo.copiedSection', { section: sectionName }),
    );
  };

  // Only show in development, local, or staging builds — or for users with dev tools access
  if (!Environment.shouldEnableDebugFeatures() && !canAccessDevTools) {
    return (
      <ProfileScreenWrapper title={t('labels.debugInfo')}>
        <View style={styles.notAvailableContainer}>
          <Text tone="secondary" align="center">
            {t('debugInfo.notAvailable')}
          </Text>
        </View>
      </ProfileScreenWrapper>
    );
  }

  return (
    <ProfileScreenWrapper title={t('labels.debugInfo')}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text role="caption" tone="secondary" style={styles.headerText}>
            {t('debugInfo.header')}
          </Text>
          <AppPressable style={styles.copyAllButton} onPress={handleCopyAll}>
            <Text role="label" style={styles.copyAllButtonText}>
              {t('debugInfo.copyAll')}
            </Text>
          </AppPressable>
        </View>

        {Object.entries(debugData).map(([sectionName, sectionData]) => (
          <View key={sectionName} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text role="heading">{sectionName}</Text>
              <AppPressable
                style={styles.copySectionButton}
                onPress={() => handleCopySection(sectionName, sectionData)}
              >
                <Text role="label" tone="accent">
                  {t('labels.copy')}
                </Text>
              </AppPressable>
            </View>
            <View style={styles.infoContainer}>
              {Object.entries(sectionData).map(([key, value]) => (
                <View key={key} style={styles.infoRow}>
                  <Text role="label" tone="secondary" style={styles.infoLabel}>
                    {key}
                  </Text>
                  <Text role="caption" style={styles.infoValue} selectable>
                    {value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text
            role="caption"
            tone="secondary"
            align="center"
            style={styles.footerText}
          >
            {t('debugInfo.footer')}
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
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  headerText: {
    marginBottom: theme.spacing.base,
  },
  copyAllButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.smPlus,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  copyAllButtonText: {
    color: theme.colors.onPrimary,
  },
  section: {
    marginVertical: theme.spacing.base,
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
    paddingHorizontal: theme.spacing.base,
    borderRadius: theme.radii.xs + 2,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.primary,
  },
  infoContainer: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  infoRow: {
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: theme.borderWidth.hairline,
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
