import React, {useState, useEffect} from 'react';
import {View, Text, ScrollView, Alert} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {
  useUpdateUserPreferencesMutation,
  useGetUserSettingsQuery,
} from '#generated';
import {SettingSwitch, SettingSection} from '#components/settings';
import {useStore} from '#/store';

export const NotificationSettingsScreen: React.FC = () => {
  const user = useStore(state => state.user);
  const {data, loading} = useGetUserSettingsQuery();
  const [updateSettings] = useUpdateUserPreferencesMutation();

  const settings = data?.userSettings;

  const [localSettings, setLocalSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    weeklyDigest: false,
    expiredItemAlerts: true,
    lowStockAlerts: true,
    shoppingListUpdates: true,
    recipeRecommendations: false,
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        emailNotifications: settings.emailNotifications ?? true,
        pushNotifications: settings.pushNotifications ?? true,
        smsNotifications: settings.smsNotifications ?? false,
        weeklyDigest: settings.weeklyDigest ?? false,
        expiredItemAlerts: settings.expiredItemAlerts ?? true,
        lowStockAlerts: settings.lowStockAlerts ?? true,
        shoppingListUpdates: settings.shoppingListUpdates ?? true,
        recipeRecommendations: settings.recipeRecommendations ?? false,
      });
    }
  }, [settings]);

  const handleSettingChange = async (key: string, value: boolean) => {
    const newSettings = {...localSettings, [key]: value};
    setLocalSettings(newSettings);

    try {
      await updateSettings({
        variables: {
          input: {[key]: value},
        },
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to update settings. Please try again.');
      setLocalSettings(localSettings);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <SettingSection title="General Notifications">
        <SettingSwitch
          title="Push Notifications"
          description="Receive push notifications on your device"
          value={localSettings.pushNotifications}
          onValueChange={value =>
            handleSettingChange('pushNotifications', value)
          }
        />
        <SettingSwitch
          title="Email Notifications"
          description="Receive notifications via email"
          value={localSettings.emailNotifications}
          onValueChange={value =>
            handleSettingChange('emailNotifications', value)
          }
        />
        <SettingSwitch
          title="SMS Notifications"
          description="Receive text message notifications"
          value={localSettings.smsNotifications}
          onValueChange={value =>
            handleSettingChange('smsNotifications', value)
          }
        />
      </SettingSection>

      <SettingSection title="Pantry Alerts">
        <SettingSwitch
          title="Expiration Alerts"
          description="Get notified when items are about to expire"
          value={localSettings.expiredItemAlerts}
          onValueChange={value =>
            handleSettingChange('expiredItemAlerts', value)
          }
        />
        <SettingSwitch
          title="Low Stock Alerts"
          description="Get notified when pantry items are running low"
          value={localSettings.lowStockAlerts}
          onValueChange={value => handleSettingChange('lowStockAlerts', value)}
        />
      </SettingSection>

      <SettingSection title="Shopping Lists">
        <SettingSwitch
          title="List Updates"
          description="Get notified when shared lists are updated"
          value={localSettings.shoppingListUpdates}
          onValueChange={value =>
            handleSettingChange('shoppingListUpdates', value)
          }
        />
      </SettingSection>

      <SettingSection title="Other">
        <SettingSwitch
          title="Weekly Digest"
          description="Receive a weekly summary of your pantry activity"
          value={localSettings.weeklyDigest}
          onValueChange={value => handleSettingChange('weeklyDigest', value)}
        />
        <SettingSwitch
          title="Recipe Recommendations"
          description="Get recipe suggestions based on your pantry items"
          value={localSettings.recipeRecommendations}
          onValueChange={value =>
            handleSettingChange('recipeRecommendations', value)
          }
        />
      </SettingSection>
    </ScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
  },
}));
