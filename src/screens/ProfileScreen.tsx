import React, {useEffect, useState} from 'react';
import {SafeAreaView, ScrollView} from 'react-native';
import {useStore} from '../store/useStore';
import {ProfileHeader} from '../components/organisms/ProfileHeader';
import {SettingsSection} from '../components/organisms/SettingsSection';
import {SettingItem} from '../components/molecules/SettingRow';
import {ModalPicker} from '../components/molecules/ModalPicker';
import {useStyles, createStyleSheet} from 'react-native-unistyles';

export default function ProfileScreen() {
  const {styles} = useStyles(stylesheet);
  const user = useStore(s => s.user);
  const logout = useStore(s => s.logout);
  const profile = useStore(s => s.userProfile);
  const preferences = useStore(s => s.preferences);
  const updatePreferences = useStore(s => s.updatePreferences);
  const updateProfile = useStore(s => s.updateProfile);
  const fetchProf = useStore(s => s.getUserProfile);

  const [langPickerVisible, setLangPickerVisible] = useState(false);

  const languageOptions = [
    {label: 'English', value: 'en'},
    {label: 'Spanish', value: 'es'},
    {label: 'French', value: 'fr'},
    // …more
  ];

  useEffect(() => {
    fetchProf();
  }, [fetchProf]);

  const personalItems: SettingItem[] = [
    {
      key: 'firstName',
      label: 'First Name',
      type: 'text',
      value: profile?.firstName || '',
      onSave: val => updateProfile({firstName: val}),
    },
    {
      key: 'lastName',
      label: 'Last Name',
      type: 'text',
      value: profile?.lastName || '',
      onSave: val => updateProfile({lastName: val}),
    },
    {
      key: 'phone',
      label: 'Phone',
      type: 'text',
      value: profile?.phone || '',
      onSave: val => updateProfile({phone: val}),
    },
    {
      key: 'birthday',
      label: 'Birthday',
      type: 'text',
      value: profile?.dateOfBirth || '',
      onSave: val => updateProfile({dateOfBirth: val}),
    },
  ];

  const themeItems: SettingItem[] = [
    {
      key: 'darkMode',
      label: 'Dark Mode',
      type: 'switch',
      value: preferences.darkMode,
      onPress: () => updatePreferences({darkMode: !preferences.darkMode}),
    },
    {
      key: 'language',
      label: 'Language',
      type: 'modal',
      value: preferences.language,
      options: languageOptions,
      onSave: val => updatePreferences({language: val}),
    },
  ];

  const notificationItems: SettingItem[] = [
    {
      key: 'emailNotif',
      label: 'Email Notifications',
      type: 'switch',
      value: preferences.emailNotifications,
      onPress: () =>
        updatePreferences({
          emailNotifications: !preferences.emailNotifications,
        }),
    },
    {
      key: 'pushNotif',
      label: 'Push Notifications',
      type: 'switch',
      value: preferences.pushNotifications,
      onPress: () =>
        updatePreferences({pushNotifications: !preferences.pushNotifications}),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ProfileHeader
        avatarUrl={profile?.avatarUrl ?? undefined}
        name={`${profile?.firstName || ''} ${profile?.lastName || ''}`}
        subtitle={user?.email || ''}
        onBack={() => {}}
        onMore={() => {}}
        onAvatarPress={() => {}}
      />

      <ScrollView contentContainerStyle={{padding: 24}}>
        <SettingsSection title="Personal Information" items={personalItems} />
        <SettingsSection title="Theme & Language" items={themeItems} />
        <SettingsSection title="Notifications" items={notificationItems} />

        {/* Log out as its own section or button */}
        <SettingsSection
          title=""
          items={[
            {
              key: 'logout',
              label: 'Log Out',
              type: 'text',
              onPress: () => logout(),
            },
          ]}
        />
      </ScrollView>

      {/* Global picker (if you prefer a separate ModalPicker) */}
      <ModalPicker
        label="Select Language"
        visible={langPickerVisible}
        options={languageOptions}
        selected={preferences.language || ''}
        onSelect={val => {
          updatePreferences({language: val});
          setLangPickerVisible(false);
        }}
        onCancel={() => setLangPickerVisible(false)}
      />
    </SafeAreaView>
  );
}
const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  scrollViewContent: {
    padding: 24,
  },
}));
