import React, { useRef, useCallback } from 'react';
import { ScrollView, Pressable, Text } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ProfileHeader } from '#components/organisms/ProfileHeader';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { useProfileData } from '#hooks/profile/useProfileData';
import { useConfigurableSettings } from '#hooks/profile/useConfigurableSettings';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { ActionTray } from '#/components/templates/ActionTray/ActionTray';
import type { ActionTrayRef } from '#/components/templates/ActionTray/types';
import { Icon } from '#/utils/iconUtils';
import { Telemetry } from '#/services/telemetry';
import { useEffect } from 'react';
import { Environment } from '#/utils/environment';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { ProfileSkeleton } from '#components/base/Skeleton/ProfileSkeleton';

export const ProfileScreen = () => {
  useScreenTransition('ProfileScreen');
  const { navigate, goBack } = useAppNavigation();
  const { profile, user, loading } = useProfileData();
  const { sections, BiometricModal, biometricLoading } =
    useConfigurableSettings(profile);
  const { bottom: safeBottom } = useSafeAreaInsets();
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
    // No-op: Profile is no longer in tab bar context
  }, []);

  const handleOverlayClose = useCallback(() => {
    // No-op: Profile is no longer in tab bar context
  }, []);

  // ✅ OPTIMIZED: Don't block render on loading
  // Show cached profile data immediately while loading fresh data in background
  // Only show loading state if we have NO data at all OR biometric data is still loading
  if ((loading && !profile) || biometricLoading) {
    return <ProfileSkeleton />;
  }
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
      testID="profile-screen"
    >
      <ProfileHeader
        avatarUrl={profile?.avatar}
        name={`${profile?.firstName || ''} ${profile?.lastName || ''}`.trim()}
        subtitle={user?.email || ''}
        onBack={() => goBack()}
        onMore={handleMorePress}
        onAvatarPress={handleAvatarPress}
      />

      <ScrollView
        testID="profile-scroll-view"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: safeBottom + 16 },
        ]}
      >
        {sections
          .filter(section => {
            // Filter out Developer section if debug features are not enabled
            if (section.title === 'Developer') {
              return Environment.shouldEnableDebugFeatures();
            }
            return true;
          })
          .map((section, index) => (
            <SettingsSection
              key={`section-${index}`}
              title={section.title}
              items={section.items.map((item: any) => {
                // Override logout handler to include navigation
                if (item.key === 'logout') {
                  return {
                    ...item,
                    testID: 'profile-logout-button',
                    onPress: handleLogout,
                  };
                }
                // Handle navigation items
                if (item.type === 'navigation') {
                  return {
                    ...item,
                    testID: `profile-menu-${item.key}`,
                    onPress: () => {
                      if (item.key === 'personalInformation') {
                        navigate('PersonalInformation');
                      } else if (item.key === 'notifications') {
                        navigate('NotificationSettings');
                      } else if (item.key === 'dietaryProfile') {
                        navigate('DietaryProfile');
                      } else if (item.key === 'appSettings') {
                        navigate('AppSettings');
                      } else if (item.key === 'debugInfo') {
                        navigate('DebugInfo');
                      } else if (item.key === 'performanceDashboard') {
                        navigate('PerformanceDashboard');
                      } else if (item.key === 'changePassword') {
                        navigate('ChangePassword');
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
        <Pressable style={({pressed}) => [styles.menuItem, pressed && styles.pressed]} onPress={handleDeleteAccount}>
          <Icon
            library="Feather"
            name="trash-2"
            size={20}
            color={theme.colors.error}
          />
          <Text style={styles.menuItemTextDestructive}>Delete Account</Text>
        </Pressable>
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
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.error,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
