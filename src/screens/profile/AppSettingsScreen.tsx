import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SettingSwitch, SettingSection } from '#components/settings';
import { ProfileScreenWrapper } from '#components/templates';
import { useAppSettings } from '#hooks/profile/useAppSettings';
import { UnitSystem } from '#generated';
import { Picker } from '@react-native-picker/picker';
import { commonStyles } from '#/styles/commonStyles';
import { useAppStore } from '#/store/useAppStore';
import { resetAllFeatureHints } from '#hooks/useFeatureHint';

export const AppSettingsScreen: React.FC = () => {
  const [updating, setUpdating] = useState<string | null>(null);

  const {
    settings,
    loading,
    updateAppSetting,
    resetToDefaults,
  } = useAppSettings();

  // PERFORMANCE: Use selective selectors instead of inline functions
  const hapticFeedbackEnabled = useAppStore(state => state.hapticFeedbackEnabled);
  const setHapticFeedbackEnabled = useAppStore(state => state.setHapticFeedbackEnabled);
  const showNavigationLabels = useAppStore(state => state.showNavigationLabels);
  const setShowNavigationLabels = useAppStore(state => state.setShowNavigationLabels);

  // Telemetry consent
  const userConsent = useAppStore(state => state.userConsent);
  const setUserConsent = useAppStore(state => state.setUserConsent);

  const handleSettingChange = async (key: string, value: any) => {
    setUpdating(key);
    try {
      const success = await updateAppSetting(key as any, value);
      if (!success) {
        Alert.alert('Error', 'Failed to update setting. Please try again.');
      }
    } finally {
      setUpdating(null);
    }
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset to Defaults',
      'Are you sure you want to reset all app settings to their default values? This will also reset all tutorials.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setUpdating('reset');
            try {
              const success = await resetToDefaults();
              // Also reset feature hints/tutorials
              resetAllFeatureHints();
              if (success) {
                Alert.alert('Success', 'Settings and tutorials have been reset to defaults.');
              } else {
                Alert.alert(
                  'Error',
                  'Failed to reset settings. Please try again.',
                );
              }
            } finally {
              setUpdating(null);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={commonStyles.loadingContainer}>
        <Text style={commonStyles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ProfileScreenWrapper title="App Settings" testID="settings-screen">
      <SettingSection title="Units & Measurements">
        <View style={styles.pickerContainer}>
          <Text style={commonStyles.subtitle}>Preferred Unit System</Text>
          <Picker
            testID="settings-unit-system-picker"
            selectedValue={settings.preferredUnitSystem}
            onValueChange={(value) => handleSettingChange('preferredUnitSystem', value)}
            style={styles.picker}
          >
            <Picker.Item label="Metric (kg, g, L, mL)" value={UnitSystem.Metric} />
            <Picker.Item label="Imperial (lb, oz, gal, fl oz)" value={UnitSystem.Imperial} />
            <Picker.Item label="System Default" value={UnitSystem.System} />
          </Picker>
        </View>
      </SettingSection>

      <SettingSection title="Sync & Offline">
        <SettingSwitch
          title="Auto Sync"
          description="Automatically sync your data when online"
          value={settings.autoSync}
          onValueChange={value => handleSettingChange('autoSync', value)}
          loading={updating === 'autoSync'}
        />
        <SettingSwitch
          title="Offline Mode"
          description="Use cached data only. Disables search and sharing."
          value={settings.offlineMode}
          onValueChange={value => handleSettingChange('offlineMode', value)}
          loading={updating === 'offlineMode'}
        />
      </SettingSection>

      <SettingSection title="Features">
        <SettingSwitch
          title="Show Tutorials"
          description="Display helpful tips and tutorials"
          value={settings.showTutorials}
          onValueChange={value => handleSettingChange('showTutorials', value)}
          loading={updating === 'showTutorials'}
        />

        {settings.betaFeatures.length > 0 && (
          <View style={styles.betaFeaturesContainer}>
            <Text style={commonStyles.subtitle}>Beta Features Enabled</Text>
            <View style={styles.chipContainer}>
              {settings.betaFeatures.map((feature, index) => (
                <View key={index} style={[commonStyles.chip, styles.betaChip]}>
                  <Text style={commonStyles.chipText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </SettingSection>

      <SettingSection title="Experience">
        <SettingSwitch
          testID="settings-haptic-feedback-switch"
          title="Haptic Feedback"
          description="Vibration feedback for interactions and alerts"
          value={hapticFeedbackEnabled}
          onValueChange={setHapticFeedbackEnabled}
        />
        <SettingSwitch
          testID="settings-navigation-labels-switch"
          title="Navigation Labels"
          description="Show text labels below navigation icons"
          value={showNavigationLabels}
          onValueChange={setShowNavigationLabels}
        />
        <SettingSwitch
          testID="settings-share-usage-data-switch"
          title="Share Usage Data"
          description="Help improve Sous Chef by sharing anonymous usage statistics"
          value={userConsent ?? true}
          onValueChange={setUserConsent}
        />
      </SettingSection>

      <SettingSection title="Reset">
        <SettingSwitch
          title="Reset to Defaults"
          description="Reset all app settings to their default values"
          value={false}
          onValueChange={handleResetToDefaults}
          loading={updating === 'reset'}
        />
      </SettingSection>
    </ProfileScreenWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  pickerContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.sm,
  },
  picker: {
    marginTop: theme.spacing.sm,
  },
  betaFeaturesContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    marginTop: theme.spacing.sm,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  betaChip: {
    marginRight: 0,
    backgroundColor: theme.colors.warning + '20',
  },
}));
