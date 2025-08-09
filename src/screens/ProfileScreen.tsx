import React, {useState} from 'react';
import {SafeAreaView, ScrollView} from 'react-native';
import {useStore} from '../store';
import {ProfileHeader} from '../components/organisms/ProfileHeader';
import {SettingsSection} from '../components/organisms/SettingsSection';
import {SettingItem} from '../components/molecules/SettingRow';
import {ModalPicker} from '../components/molecules/ModalPicker';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import {useUserProfileQuery} from '../graphql/generated';
import {useUserData} from '../hooks/useUserData';
import {useNavigation} from '@react-navigation/native';

export default function ProfileScreen() {
  const {styles} = useStyles(stylesheet);
  const navigation = useNavigation();

  const {user} = useUserData(true);

  const {firstName, lastName, phone, dateOfBirth, avatarUrl} = user || {};

  const {
    logout,
    theme,
    setTheme,
    language,
    setLanguage,
    emailNotifications,
    setEmailNotifications,
    pushNotifications,
  } = useStore();
  const {updatePreferences} = useStore();

  const [updateProfile] = useUpdateUserProfileMutation({
    onCompleted: data => {
      if (data.updateUserProfile) {
        console.log('Profile updated successfully');
      } else {
        console.error('Failed to update profile');
      }
    },
    onError: error => {
      console.error('Error updating profile:', error);
    },
  });

  const [langPickerVisible, setLangPickerVisible] = useState(false);

  const languageOptions = [
    {label: 'English', value: 'en'},
    {label: 'Spanish', value: 'es'},
    {label: 'French', value: 'fr'},
    // …more
  ];

  const personalItems: SettingItem[] = [
    {
      key: 'firstName',
      label: 'First Name',
      type: 'text',
      value: profile?.firstName || '',
      onSave: val =>
        updateProfile({
          variables: {data: {firstName: val}},
        }),
    },
    {
      key: 'lastName',
      label: 'Last Name',
      type: 'text',
      value: profile?.lastName || '',
      onSave: val =>
        updateProfile({
          variables: {data: {lastName: val}},
        }),
    },
    {
      key: 'phone',
      label: 'Phone',
      type: 'text',
      value: profile?.phone || '',
      onSave: val =>
        updateProfile({
          variables: {data: {phone: val}},
        }),
    },
    {
      key: 'birthday',
      label: 'Birthday',
      type: 'text',
      value: profile?.dateOfBirth || '',
      onSave: val =>
        updateProfile({
          variables: {data: {dateOfBirth: val}},
        }),
    },
  ];

  const themeItems: SettingItem[] = [
    {
      key: 'darkMode',
      label: 'Dark Mode',
      type: 'switch',
      value: theme === 'dark',
      onPress: () =>
        updatePreferences({
          theme: theme === 'dark' ? 'light' : 'dark',
        }),
    },
    {
      key: 'language',
      label: 'Language',
      type: 'modal',
      value: language,
      options: languageOptions,
      onSave: val => updatePreferences({language: val}),
    },
  ];

  const notificationItems: SettingItem[] = [
    {
      key: 'emailNotif',
      label: 'Email Notifications',
      type: 'switch',
      value: emailNotifications,
      onPress: () =>
        updatePreferences({
          emailNotifications: !emailNotifications,
        }),
    },
    {
      key: 'pushNotif',
      label: 'Push Notifications',
      type: 'switch',
      value: pushNotifications,
      onPress: () => updatePreferences({pushNotifications: !pushNotifications}),
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
              onPress: () => {
                logout();
                navigation.reset({
                  index: 0,
                  routes: [{name: 'Auth'}],
                });
              },
            },
          ]}
        />
      </ScrollView>

      {/* Global picker (if you prefer a separate ModalPicker) */}
      <ModalPicker
        label="Select Language"
        visible={langPickerVisible}
        options={languageOptions}
        selected={language || ''}
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
