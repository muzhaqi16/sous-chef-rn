import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { ProfileHeader, SettingsSection } from '#components';
import {
  useProfileData,
  useConfigurableSettings,
  useAppNavigation,
} from '#hooks';

// Tab bar height constant (65px from FloatingTabBar)
const TAB_BAR_HEIGHT = 65;

export const ProfileScreen = () => {
  const { navigate, goBack } = useAppNavigation();
  const { profile, user, loading } = useProfileData();
  const { sections, BiometricModal } = useConfigurableSettings(profile);
  const { bottom: safeBottom } = useSafeAreaInsets();

  const handleAvatarPress = () => {
    navigate('ProfilePhotoUpload');
  };

  const handleLogout = () => {
    // Find and execute logout action
    const logoutSection = sections.find(s => s.title === '');
    const logoutItem = logoutSection?.items.find(
      (i: any) => i.key === 'logout',
    );

    if (logoutItem?.onPress) {
      logoutItem.onPress();
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
        onBack={() => goBack()}
        onMore={() => { }}
        onAvatarPress={handleAvatarPress}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_HEIGHT + safeBottom + 16 },
        ]}
      >
        {sections.map((section, index) => (
          <SettingsSection
            key={`section-${index}`}
            title={section.title}
            items={section.items.map((item: any) => {
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

      {BiometricModal}
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
