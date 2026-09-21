import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { StyleSheet } from 'react-native-unistyles';
import { SubScreen } from '#components/templates/SubScreen';
import { Environment } from '#/utils/environment';
import { env } from '#/config/env';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Clipboard from '@react-native-clipboard/clipboard';
import { useCanAccessDevTools } from '#store/useAppStore';
import { Text } from '#components/atoms/Text';

interface DebugRow {
  label: string;
  value: string;
}

interface DebugSection {
  title: string;
  rows: readonly DebugRow[];
}

const formatRows = (rows: readonly DebugRow[]) =>
  rows.map(({ label, value }) => `${label}: ${value}`).join('\n');

export const DebugInfo: React.FC = () => {
  const { t } = useTranslation();
  const canAccessDevTools = useCanAccessDevTools();
  const config = Environment.getConfig();
  const apiConfig = Environment.getApiConfig();

  const yesNo = (flag: boolean) => (flag ? t('labels.yes') : t('labels.no'));
  const presence = (value: string | undefined) =>
    value ? t('debugInfo.values.configured') : t('debugInfo.values.notSet');
  const orNotSet = (value: string | undefined) =>
    value ?? t('debugInfo.values.notSet');

  const debugData: readonly DebugSection[] = [
    {
      title: t('debugInfo.sections.environment'),
      rows: [
        { label: t('debugInfo.rows.buildMode'), value: config.buildMode },
        {
          label: t('debugInfo.rows.isDevelopment'),
          value: yesNo(config.isDevelopment),
        },
        {
          label: t('debugInfo.rows.isStaging'),
          value: yesNo(config.isStaging),
        },
        {
          label: t('debugInfo.rows.isProduction'),
          value: yesNo(config.isProduction),
        },
        {
          label: t('debugInfo.rows.isTesting'),
          value: yesNo(config.isTesting),
        },
      ],
    },
    {
      title: t('debugInfo.sections.apiConfiguration'),
      rows: [
        {
          label: t('debugInfo.rows.apiUrl'),
          value: env.API_URL ?? apiConfig.baseUrl,
        },
        {
          label: t('debugInfo.rows.webSocketUrl'),
          value: env.WEB_SOCKET_URL ?? apiConfig.wsUrl,
        },
        // Presence only. This screen is reachable by a production account with
        // dev-tools access and everything here is copyable, so no part of a
        // credential appears; a prefix identifies the key too.
        { label: t('debugInfo.rows.apiKey'), value: presence(env.API_KEY) },
        {
          label: t('debugInfo.rows.timeout'),
          value: t('debugInfo.values.milliseconds', {
            value: apiConfig.timeout,
          }),
        },
        {
          label: t('debugInfo.rows.maxRetries'),
          value: apiConfig.retries.toString(),
        },
      ],
    },
    {
      title: t('debugInfo.sections.telemetry'),
      rows: [
        {
          label: t('debugInfo.rows.metricsEndpoint'),
          value: orNotSet(env.OTLP_METRICS_ENDPOINT),
        },
        {
          label: t('debugInfo.rows.logsEndpoint'),
          value: orNotSet(env.OTLP_LOGS_ENDPOINT),
        },
        {
          label: t('debugInfo.rows.metricsAuth'),
          value: presence(env.OTLP_METRICS_AUTH_USERNAME),
        },
        {
          label: t('debugInfo.rows.logsAuth'),
          value: presence(env.OTLP_LOGS_AUTH_USERNAME),
        },
      ],
    },
    {
      title: t('debugInfo.sections.deviceInfo'),
      rows: [
        { label: t('debugInfo.rows.platform'), value: Platform.OS },
        {
          label: t('debugInfo.rows.osVersion'),
          value: Platform.Version.toString(),
        },
        {
          label: t('debugInfo.rows.appVersion'),
          value: DeviceInfo.getVersion(),
        },
        {
          label: t('debugInfo.rows.buildNumber'),
          value: DeviceInfo.getBuildNumber(),
        },
        {
          label: t('debugInfo.rows.bundleId'),
          value: DeviceInfo.getBundleId(),
        },
        {
          label: t('debugInfo.rows.deviceBrand'),
          value: DeviceInfo.getBrand(),
        },
        {
          label: t('debugInfo.rows.deviceModel'),
          value: DeviceInfo.getModel(),
        },
      ],
    },
    {
      title: t('debugInfo.sections.buildConfiguration'),
      rows: [
        // The variable's own name: a technical identifier, not copy.
        { label: 'NODE_ENV', value: orNotSet(env.NODE_ENV) },
        {
          label: t('debugInfo.rows.webAppUrl'),
          value: orNotSet(env.WEB_APP_URL),
        },
      ],
    },
  ];

  const handleCopyAll = () => {
    const allDebugInfo = debugData
      .map(({ title, rows }) => `=== ${title} ===\n${formatRows(rows)}`)
      .join('\n\n');

    Clipboard.setString(allDebugInfo);
    alertService.alert(t('labels.copied'), t('debugInfo.copiedAll'));
  };

  const handleCopySection = ({ title, rows }: DebugSection) => {
    Clipboard.setString(formatRows(rows));
    alertService.alert(
      t('labels.copied'),
      t('debugInfo.copiedSection', { section: title }),
    );
  };

  // Only show in development, local, or staging builds — or for users with dev tools access
  if (!Environment.shouldEnableDebugFeatures() && !canAccessDevTools) {
    return (
      <SubScreen title={t('labels.debugInfo')}>
        <View style={styles.notAvailableContainer}>
          <Text role="body" tone="secondary" align="center">
            {t('debugInfo.notAvailable')}
          </Text>
        </View>
      </SubScreen>
    );
  }

  return (
    <SubScreen title={t('labels.debugInfo')}>
      <>
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

        {debugData.map(section => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text role="heading">{section.title}</Text>
              <AppPressable
                style={styles.copySectionButton}
                onPress={() => handleCopySection(section)}
              >
                <Text role="label" tone="accent">
                  {t('labels.copy')}
                </Text>
              </AppPressable>
            </View>
            <View style={styles.infoContainer}>
              {section.rows.map(({ label, value }) => (
                <View key={label} style={styles.infoRow}>
                  <Text role="label" tone="secondary" style={styles.infoLabel}>
                    {label}
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
      </>
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  notAvailableContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  header: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
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
