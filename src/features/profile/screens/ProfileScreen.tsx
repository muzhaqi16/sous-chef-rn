import React, { useRef } from 'react';
import { useTranslation } from '#/i18n';

import { AppPressable } from '#components/atoms/AppPressable';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { ProfileHeader } from '#features/profile/components/ProfileHeader';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { useProfileData } from '#features/profile/hooks/useProfileData';
import { useConfigurableSettings } from '#features/profile/hooks/useConfigurableSettings';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { ActionTray } from '#components/templates/ActionTray/ActionTray';
import type { ActionTrayRef } from '#components/templates/ActionTray/types';
import { Icon } from '#/utils/iconUtils';
import { Telemetry } from '#/services/telemetry';
import { useEffect } from 'react';
import { Environment } from '#/utils/environment';
import { DEVELOPER_SECTION_ID } from '#/config/settingsConfig';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { ProfileSkeleton } from '#features/profile/components/ProfileSkeleton';
import {
  useCanAccessDevTools,
  useHasUnverifiedEmail,
} from '#store/useAppStore';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { Text } from '#components/atoms/Text';
import { motion } from '#/theme/foundations/motion';
import { Screen } from '#components/templates/Screen';

const HEADER_TIMING = {
  duration: motion.timing.SLOW,
  easing: motion.easing.standard,
};

export const ProfileScreen = () => {
  const { t } = useTranslation();
  useScreenTransition('ProfileScreen');
  const canAccessDevTools = useCanAccessDevTools();
  const hasUnverifiedEmail = useHasUnverifiedEmail();
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
    toVerifyEmail,
    goBack,
  } = useAppNavigation();
  const { profile, user, loading } = useProfileData();
  const { sections, BiometricModal } = useConfigurableSettings();
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

  // Takes the row's OWN handler rather than looking the row up by key — one
  // binding, the item the renderer already has in hand, so a renamed section
  // key cannot leave the button firing telemetry and nothing else.
  const handleLogout = (performLogout: (() => void) | undefined) => {
    Telemetry.trackEvent('logout_clicked', { source: 'ProfileScreen' });
    performLogout?.();
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
    // No-op: Profile sits outside the tab bar context.
  };

  const handleOverlayClose = () => {
    // No-op: Profile sits outside the tab bar context.
  };

  // Cached data renders immediately; only a total absence shows the skeleton.
  if (loading && !profile) {
    return <ProfileSkeleton />;
  }
  return (
    <Screen scroll="list" gutter="none" testID="profile-screen">
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
        {!!hasUnverifiedEmail && (
          <AlertBanner
            title={t('auth.verifyEmailBannerTitle')}
            subtitle={t('auth.verifyEmailBannerSubtitle')}
            icon="mail-unread-outline"
            iconLibrary="Ionicons"
            variant="warning"
            onPress={toVerifyEmail}
            testID="verify-email-banner"
          />
        )}
        {sections
          .filter(section => {
            // Filter out Developer section if debug features are not enabled.
            // Compare against the stable `key` so the filter still works in
            // non-English locales where `title` is translated. The id is
            // imported rather than spelled out, so a rename cannot leave the
            // comparison matching nothing while the section renders to
            // everyone.
            if (section.key === DEVELOPER_SECTION_ID) {
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
              items={section.items.map(item => {
                // Wrap the row's own handler so the tap is recorded; the
                // handler itself stays the one the settings config built.
                if (item.key === 'logout') {
                  return {
                    ...item,
                    testID: 'profile-logout-button',
                    onPress: () => handleLogout(item.onPress),
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
        <AppPressable style={styles.menuItem} onPress={handleDeleteAccount}>
          <Icon name="trash-outline" size={20} tone="error" />
          <Text
            role="bodyStrong"
            tone="error"
            style={styles.menuItemTextDestructive}
          >
            {t('account.deleteTitle')}
          </Text>
        </AppPressable>
      </ActionTray>
    </Screen>
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
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
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
