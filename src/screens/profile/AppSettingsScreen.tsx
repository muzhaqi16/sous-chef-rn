import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SettingSwitch, SettingSection } from '#components/settings';
import { ProfileScreenWrapper } from '#components/templates';
import { useAppSettings } from '#hooks/profile/useAppSettings';
import { UnitSystem } from '#generated';
import { Picker } from '@react-native-picker/picker';
import { commonStyles } from '#/styles/commonStyles';
import { useStore } from '#/store';

export const AppSettingsScreen: React.FC = () => {
  const [updating, setUpdating] = useState<string | null>(null);

  const {
    settings,
    loading,
    updateAppSetting,
    resetToDefaults,
  } = useAppSettings();

  // Haptic feedback preference from store
  const hapticFeedbackEnabled = useStore(state => state.hapticFeedbackEnabled);
  const setHapticFeedbackEnabled = useStore(state => state.setHapticFeedbackEnabled);

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
      'Are you sure you want to reset all app settings to their default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setUpdating('reset');
            try {
              const success = await resetToDefaults();
              if (success) {
                Alert.alert('Success', 'Settings have been reset to defaults.');
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
    <ProfileScreenWrapper title="App Settings">
      <SettingSection title="Units & Measurements">
        <View style={styles.pickerContainer}>
          <Text style={commonStyles.subtitle}>Preferred Unit System</Text>
          <Picker
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
          description="Enable offline mode to work without internet"
          value={settings.offlineMode}
          onValueChange={value => handleSettingChange('offlineMode', value)}
          loading={updating === 'offlineMode'}
        />
      </SettingSection>

      <SettingSection title="Privacy & Data">
        <SettingSwitch
          title="Share Usage Data"
          description="Help improve the app by sharing anonymous usage data"
          value={settings.shareUsageData}
          onValueChange={value => handleSettingChange('shareUsageData', value)}
          loading={updating === 'shareUsageData'}
        />
        <SettingSwitch
          title="Share with Partners"
          description="Allow sharing data with trusted partners"
          value={settings.shareWithPartners}
          onValueChange={value => handleSettingChange('shareWithPartners', value)}
          loading={updating === 'shareWithPartners'}
        />
        <SettingSwitch
          title="Personalized Ads"
          description="Show ads tailored to your interests"
          value={settings.personalizedAds}
          onValueChange={value => handleSettingChange('personalizedAds', value)}
          loading={updating === 'personalizedAds'}
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
          title="Haptic Feedback"
          description="Vibration feedback for interactions and alerts"
          value={hapticFeedbackEnabled}
          onValueChange={setHapticFeedbackEnabled}
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
