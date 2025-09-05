import React from 'react';
import {SafeAreaView, ScrollView} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StyleSheet} from 'react-native-unistyles';
import {ProfileHeader, SettingsSection} from '#components';
import {useProfileData, useConfigurableSettings} from '#hooks';

export const ProfileScreen = () => {
  const navigation = useNavigation();
  const {profile, user, loading} = useProfileData();
  const {sections} = useConfigurableSettings(profile);

  const handleAvatarPress = () => {
    navigation.navigate('ProfilePhotoUpload');
  };

  const handleLogout = () => {
    // Find and execute logout action
    const logoutSection = sections.find(s => s.title === '');
    const logoutItem = logoutSection?.items.find(i => i.key === 'logout');

    if (logoutItem?.onPress) {
      logoutItem.onPress();
      navigation.reset({
        index: 0,
        routes: [{name: 'AuthStack'}],
      });
    }
  };

  if (loading) {
    return null; // or loading component
  }
  return (
    <SafeAreaView style={styles.container}>
      <ProfileHeader
        avatarUrl={profile?.avatar}
        name={`${profile?.firstName || ''} ${profile?.lastName || ''}`.trim()}
        subtitle={user?.email || ''}
        onBack={() => navigation.goBack()}
        onMore={() => {}}
        onAvatarPress={handleAvatarPress}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {sections.map((section, index) => (
          <SettingsSection
            key={`section-${index}`}
            title={section.title}
            items={section.items.map(item => {
              // Override logout handler to include navigation
              if (item.key === 'logout') {
                return {
                  ...item,
                  onPress: handleLogout,
                };
              }
              return item;
            })}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 24,
  },
}));
