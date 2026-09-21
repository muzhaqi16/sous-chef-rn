import React, { useRef } from 'react';
import { useTranslation } from '#/i18n';

import { AppPressable } from '#components/atoms/AppPressable';
import {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { ProfileHero } from '#features/profile/components/ProfileHero';
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
import { Screen } from '#components/templates/Screen';
import { profileTestIDs } from '#features/profile/testIDs';
import { firstNonBlank } from '#/utils/firstNonBlank';

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
  const actionTrayRef = useRef<ActionTrayRef>(null);
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.set(event.contentOffset.y);
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

  const fullName = `${profile?.firstName ?? ''} ${
    profile?.lastName ?? ''
  }`.trim();
  const headerName = firstNonBlank(profile?.displayName, fullName) ?? '';

  // Cached data renders immediately; only a total absence shows the skeleton.
  if (loading && !profile) {
    return <ProfileSkeleton onBack={() => goBack()} />;
  }
  return (
    <Screen
      scroll="scroll"
      onScroll={scrollHandler}
      scrollTestID={profileTestIDs.profileScrollView}
      testID={profileTestIDs.profileScreen}
      header={{
        back: () => goBack(),
        actions: [
          {
            icon: 'ellipsis-vertical',
            onPress: handleMorePress,
            accessibilityLabel: t('labels.moreOptions'),
            testID: profileTestIDs.moreButton,
          },
        ],
      }}
    >
      <ProfileHero
        avatarUrl={profile?.avatar}
        name={headerName}
        subtitle={user?.email ?? ''}
        onAvatarPress={handleAvatarPress}
        scrollY={scrollY}
      />
      {!!hasUnverifiedEmail && (
        <AlertBanner
          title={t('auth.verifyEmailBannerTitle')}
          subtitle={t('auth.verifyEmailBannerSubtitle')}
          icon="mail-unread-outline"
          iconLibrary="Ionicons"
          variant="warning"
          onPress={toVerifyEmail}
          testID={profileTestIDs.verifyEmailBanner}
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
            return Environment.shouldEnableDebugFeatures() || canAccessDevTools;
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
                  testID: profileTestIDs.logoutButton,
                  onPress: () => handleLogout(item.onPress),
                };
              }
              // Handle navigation items
              if (item.type === 'navigation') {
                return {
                  ...item,
                  testID: profileTestIDs.menuItem(item.key),
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
            tone="danger"
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
}));
