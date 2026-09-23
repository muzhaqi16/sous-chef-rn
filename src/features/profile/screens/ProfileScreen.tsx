import React, { useRef } from 'react';
import { View } from 'react-native';
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
import { SubScreen } from '#components/templates/SubScreen';
import { profileTestIDs } from '#features/profile/testIDs';
import { firstNonBlank } from '#/utils/firstNonBlank';

export const ProfileScreen = () => {
  const { t } = useTranslation();
  useScreenTransition('ProfileScreen');
  const canAccessDevTools = useCanAccessDevTools();
  const hasUnverifiedEmail = useHasUnverifiedEmail();
  const { toProfilePhotoUpload, toDeleteAccount, toVerifyEmail, goBack } =
    useAppNavigation();
  const { profile, user, loading } = useProfileData();
  const { sections, BiometricModal, logout } = useConfigurableSettings();
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

  const handleLogout = () => {
    Telemetry.trackEvent('logout_clicked', { source: 'ProfileScreen' });
    actionTrayRef.current?.close();
    logout();
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

  const fullName = `${profile?.firstName ?? ''} ${
    profile?.lastName ?? ''
  }`.trim();
  const headerName = firstNonBlank(profile?.displayName, fullName) ?? '';

  // Cached data renders immediately; only a total absence shows the skeleton.
  if (loading && !profile) {
    return <ProfileSkeleton onBack={() => goBack()} />;
  }
  return (
    <SubScreen
      onScroll={scrollHandler}
      scrollTestID={profileTestIDs.profileScrollView}
      testID={profileTestIDs.profileScreen}
      actions={[
        {
          icon: 'ellipsis-vertical',
          onPress: handleMorePress,
          accessibilityLabel: t('labels.moreOptions'),
          testID: profileTestIDs.moreButton,
        },
      ]}
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
            items={section.items.map(item =>
              item.type === 'navigation'
                ? { ...item, testID: profileTestIDs.menuItem(item.key) }
                : item,
            )}
          />
        ))}
      {BiometricModal}
      <ActionTray ref={actionTrayRef}>
        <View style={styles.menu}>
          <AppPressable
            style={styles.menuItem(false)}
            onPress={handleLogout}
            testID={profileTestIDs.logoutButton}
          >
            <Icon name="log-out-outline" size={20} tone="textPrimary" />
            <Text role="bodyStrong">{t('profile.labels.logout')}</Text>
          </AppPressable>
          <AppPressable
            style={styles.menuItem(true)}
            onPress={handleDeleteAccount}
          >
            <Icon name="trash-outline" size={20} tone="error" />
            <Text role="bodyStrong" tone="danger">
              {t('account.deleteTitle')}
            </Text>
          </AppPressable>
        </View>
      </ActionTray>
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  menu: {
    gap: theme.spacing.sm,
  },
  menuItem: (destructive: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: destructive ? theme.colors.error : theme.colors.border,
    backgroundColor: 'transparent',
  }),
}));
