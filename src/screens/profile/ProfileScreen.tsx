import React, { useRef, useCallback } from 'react';
import { ScrollView, TouchableOpacity, Text } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ProfileHeader, SettingsSection } from '#components';
import {
  useProfileData,
  useConfigurableSettings,
  useAppNavigation,
} from '#hooks';
import { ActionTray, ActionTrayRef } from '#/components/templates/ActionTray';
import { useScanner } from '#/context/ScannerContext';
import { Icon } from '#/utils';
import { Telemetry } from '#/services/telemetry';
import { useEffect } from 'react';

// Tab bar height constant (65px from FloatingTabBar)
const TAB_BAR_HEIGHT = 65;

export const ProfileScreen = () => {
  const { navigate, goBack } = useAppNavigation();
  const { profile, user, loading } = useProfileData();
  const { sections, BiometricModal, biometricLoading } =
    useConfigurableSettings(profile);
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { setOverlayOpen } = useScanner();
  const { theme } = useUnistyles();
  const actionTrayRef = useRef<ActionTrayRef>(null);

  // Track screen view on mount
  useEffect(() => {
    Telemetry.trackScreen('ProfileScreen', {
      has_profile: !!profile,
      has_avatar: !!profile?.avatar,
    });
  }, [profile]);

  const handleAvatarPress = () => {
    Telemetry.trackEvent('avatar_upload_clicked', { source: 'ProfileScreen' });
    navigate('ProfilePhotoUpload');
  };

  const handleLogout = () => {
    Telemetry.trackEvent('logout_clicked', { source: 'ProfileScreen' });
    // Find and execute logout action
    const logoutSection = sections.find(s => s.title === '');
    const logoutItem = logoutSection?.items.find(
      (i: any) => i.key === 'logout',
    );

    if (logoutItem?.onPress) {
      logoutItem.onPress();
    }
  };

  const handleMorePress = useCallback(() => {
    Telemetry.trackEvent('profile_more_menu_opened');
    actionTrayRef.current?.open();
  }, []);

  const handleDeleteAccount = useCallback(() => {
    Telemetry.trackEvent('delete_account_clicked');
    actionTrayRef.current?.close();
    navigate('DeleteAccount');
  }, [navigate]);

  const handleOverlayOpen = useCallback(() => {
    setOverlayOpen(true);
  }, [setOverlayOpen]);

  const handleOverlayClose = useCallback(() => {
    setOverlayOpen(false);
  }, [setOverlayOpen]);

  // ✅ OPTIMIZED: Don't block render on loading
  // Show cached profile data immediately while loading fresh data in background
  // Only show loading state if we have NO data at all OR biometric data is still loading
  if ((loading && !profile) || biometricLoading) {
    return null; // or loading component
  }
  return (
    <SafeAreaView style={styles.container}>
      <ProfileHeader
        avatarUrl={profile?.avatar}
        name={`${profile?.firstName || ''} ${profile?.lastName || ''}`.trim()}
        subtitle={user?.email || ''}
        onBack={() => goBack()}
        onMore={handleMorePress}
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
              // Handle navigation items
              if (item.type === 'navigation') {
                return {
                  ...item,
                  onPress: () => {
                    if (item.key === 'personalInformation') {
                      navigate('PersonalInformation');
                    } else if (item.key === 'notifications') {
                      navigate('NotificationSettings');
                    } else if (item.key === 'dietaryProfile') {
                      navigate('DietaryProfile');
                    } else if (item.key === 'appSettings') {
                      navigate('AppSettings');
                    }
                  },
                };
              }
              return item;
            })}
          />
        ))}
      </ScrollView>

      {BiometricModal}

      <ActionTray
        ref={actionTrayRef}
        onOpen={handleOverlayOpen}
        onClose={handleOverlayClose}
      >
        <TouchableOpacity style={styles.menuItem} onPress={handleDeleteAccount}>
          <Icon
            library="Feather"
            name="trash-2"
            size={20}
            color={theme.colors.error}
          />
          <Text style={styles.menuItemTextDestructive}>Delete Account</Text>
        </TouchableOpacity>
      </ActionTray>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingVertical: theme.spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.error,
    backgroundColor: 'transparent',
  },
  menuItemTextDestructive: {
    marginLeft: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
    color: theme.colors.error,
  },
}));
