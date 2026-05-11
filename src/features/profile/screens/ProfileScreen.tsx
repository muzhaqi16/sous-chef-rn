import React, { useRef } from 'react';

import { Pressable } from '#components/atoms/themedComponents';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { ProfileHeader } from '#components/organisms/ProfileHeader';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { useProfileData } from '#features/profile/hooks/useProfileData';
import { useConfigurableSettings } from '#features/profile/hooks/useConfigurableSettings';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { ActionTray } from '#/components/templates/ActionTray/ActionTray';
import type { ActionTrayRef } from '#/components/templates/ActionTray/types';
import { Icon } from '#/utils/iconUtils';
import { Telemetry } from '#/services/telemetry';
import { useEffect } from 'react';
import { Environment } from '#/utils/environment';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { ProfileSkeleton } from '#components/base/Skeleton/ProfileSkeleton';
import { useCanAccessDevTools } from '#store/useAppStore';
import { Text } from '#components/atoms/Text';

const HEADER_TIMING = {
  duration: 300,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

export const ProfileScreen = () => {
  useScreenTransition('ProfileScreen');
  const canAccessDevTools = useCanAccessDevTools();
  const {
    toProfilePhotoUpload,
    toDeleteAccount,
    toPersonalInformation,
    toAppearance,
    toNotificationSettings,
    toDietaryProfile,
    toAppSettings,
    toDebugInfo,
    toPerformanceDashboard,
    toChangePassword,
    goBack,
  } = useAppNavigation();
  const { profile, user, loading } = useProfileData();
  const { sections, BiometricModal } = useConfigurableSettings(profile);
  const { bottom: safeBottom } = useSafeAreaInsets();
  const actionTrayRef = useRef<ActionTrayRef>(null);
  const headerProgress = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      const y = event.contentOffset.y;
      // Hysteresis: wide gap (10–40px) prevents oscillation at boundary
      // < 0.5 / > 0.5 checks work during mid-animation (vs === 0/1 which miss)
      if (y > 40 && headerProgress.get() < 0.5) {
        headerProgress.set(withTiming(1, HEADER_TIMING));
      } else if (y <= 10 && headerProgress.get() > 0.5) {
        headerProgress.set(withTiming(0, HEADER_TIMING));
      }
    },
  });

  // Track screen view on mount
  useEffect(() => {
    Telemetry.trackScreen('ProfileScreen', {
      has_profile: !!profile,
      has_avatar: !!profile?.avatar,
    });
  }, [profile]);

  const handleAvatarPress = () => {
    Telemetry.trackEvent('avatar_upload_clicked', { source: 'ProfileScreen' });
    toProfilePhotoUpload();
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

  const handleMorePress = () => {
    Telemetry.trackEvent('profile_more_menu_opened');
    actionTrayRef.current?.open();
  };

  const handleDeleteAccount = () => {
    Telemetry.trackEvent('delete_account_clicked');
    actionTrayRef.current?.close();
    toDeleteAccount();
  };

  const handleOverlayOpen = () => {
    // No-op: Profile is no longer in tab bar context
  };

  const handleOverlayClose = () => {
    // No-op: Profile is no longer in tab bar context
  };

  // ✅ OPTIMIZED: Don't block render on loading
  // Show cached profile data immediately while loading fresh data in background
  // Only show loading state if we have NO data at all
  // Biometric loading is handled inline (toggle disabled while loading)
  if (loading && !profile) {
    return <ProfileSkeleton />;
  }
  return (
    <SafeAreaView
      style={styles.container}
      edges={['left', 'right']}
      testID="profile-screen"
    >
      <ProfileHeader
        avatarUrl={profile?.avatar}
        name={
          profile?.displayName ||
          `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim()
        }
        subtitle={user?.email || ''}
        onBack={() => goBack()}
        onMore={handleMorePress}
        onAvatarPress={handleAvatarPress}
        progress={headerProgress}
      />

      <Animated.ScrollView
        testID="profile-scroll-view"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: safeBottom + 16 },
        ]}
      >
        {sections
          .filter(section => {
            // Filter out Developer section if debug features are not enabled
            if (section.title === 'Developer') {
              return (
                Environment.shouldEnableDebugFeatures() || canAccessDevTools
              );
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
                        toPersonalInformation();
                      } else if (item.key === 'appearance') {
                        toAppearance();
                      } else if (item.key === 'notifications') {
                        toNotificationSettings();
                      } else if (item.key === 'dietaryProfile') {
                        toDietaryProfile();
                      } else if (item.key === 'appSettings') {
                        toAppSettings();
                      } else if (item.key === 'debugInfo') {
                        toDebugInfo();
                      } else if (item.key === 'performanceDashboard') {
                        toPerformanceDashboard();
                      } else if (item.key === 'changePassword') {
                        toChangePassword();
                      }
                    },
                  };
                }
                return item;
              })}
            />
          ))}
      </Animated.ScrollView>

      {BiometricModal}

      <ActionTray
        ref={actionTrayRef}
        onOpen={handleOverlayOpen}
        onClose={handleOverlayClose}
      >
        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          onPress={handleDeleteAccount}
        >
          <Icon name="trash-outline" size={20} tone="error" />
          <Text
            size="md"
            weight="semibold"
            tone="error"
            style={styles.menuItemTextDestructive}
          >
            Delete Account
          </Text>
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
    paddingBottom: theme.spacing.lg,
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
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
