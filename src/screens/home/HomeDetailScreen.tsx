import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppPressable } from '#components/atoms/AppPressable';
import type { StaticScreenProps } from '@react-navigation/native';
import { alertService } from '#/services/alertService';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import Clipboard from '@react-native-clipboard/clipboard';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  useHomeDetailManagement,
  ROLE_OPTIONS,
} from '#hooks/home/useHomeDetailManagement';

import { DetailTemplate } from '#components/templates/DetailTemplate';
import { ModalPicker } from '#components/molecules/ModalPicker';
import { EditableField } from '#components/molecules/EditableField';
import { NavigationRow } from '#components/molecules/NavigationRow';

const ThemedNavigationRow = withUnistyles(NavigationRow, theme => ({
  iconColor: theme.colors.primary,
}));
import { HomeMembersSection } from '#components/organisms/home/HomeMembersSection';
import { SettingSwitch } from '#components/settings/SettingSwitch';
import { useUser } from '#store/useAppStore';
import { Icon } from '#utils/iconUtils';
import { Button } from '#components/base/Button';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { executeRefreshWithFinally } from '#/utils/compilerSafeWrappers';
import { SousChefLoader } from '#/components/base/SousChefLoader';
import { Text } from '#components/atoms/Text';
import { getInviteDisplayName } from '#/utils/formatters/inviteFormatters';
import { getMemberDisplayName } from '#/utils/formatters/memberFormatters';
import { buildJoinHomeUrl, shareUrl } from '#/utils/deepLinkUrls';

type RouteParams = {
  homeId: string;
};

export const HomeDetailScreen: React.FC<StaticScreenProps<RouteParams>> = ({
  route,
}) => {
  useScreenTransition('HomeDetailScreen');
  const { t } = useTranslation();
  const { goBack, toStorageLocations } = useAppNavigation();
  const { homeId } = route.params;
  // PERFORMANCE: Use selective selector instead of full store subscription
  const currentUser = useUser();

  const [copied, setCopied] = useState(false);
  const [joinCodeLoading, setJoinCodeLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const {
    home,
    loading,
    error,
    leaving,
    refetch,
    rolePickerState,
    handleRoleSelect,
    closeRolePicker,
    saveName,
    changeRole,
    removeMember,
    revokeInvite,
    leaveHome,
    toggleJoinCode,
    rotateJoinCode,
    rotatingJoinCode,
    transferOwnership,
    updateMemberPermission,
  } = useHomeDetailManagement(homeId);

  const handleRefresh = () => {
    executeRefreshWithFinally(() => refetch(), setRefreshing);
  };

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  const handleCopyJoinCode = () => {
    if (home?.joinCode) {
      Clipboard.setString(home.joinCode);
      setCopied(true);
    }
  };

  const handleShareJoinLink = () => {
    if (home?.joinCode) {
      // Prefer the server-built link; fall back to the client builder.
      const url = home.joinLink?.universal ?? buildJoinHomeUrl(home.joinCode);
      void shareUrl(url, t('homeDetail.shareLinkMessage'));
    }
  };

  // Transferring ownership is irreversible from this side (the new owner must
  // hand it back) — confirm with the target member's name.
  const handleTransferOwnership = (memberUserId: string, name: string) => {
    alertService.alert(
      t('homeDetail.transferOwnershipTitle'),
      t('homeDetail.transferOwnershipMessage', { name }),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('homeDetail.transferOwnershipConfirm'),
          style: 'destructive',
          onPress: () => {
            void transferOwnership(memberUserId);
          },
        },
      ],
    );
  };

  // Rotating the code invalidates any previously-shared link — confirm first.
  const handleRotateJoinCode = () => {
    alertService.alert(
      t('homeDetail.rotateJoinCodeTitle'),
      t('homeDetail.rotateJoinCodeMessage'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('homeDetail.rotateJoinCodeConfirm'),
          onPress: () => {
            void rotateJoinCode();
          },
        },
      ],
    );
  };

  const handleToggleJoinCode = (enabled: boolean) => {
    executeRefreshWithFinally(
      () => toggleJoinCode(enabled),
      setJoinCodeLoading,
    );
  };

  const currentUserMembership = home?.myMembership;
  const isOwner = currentUserMembership?.role === 'OWNER';
  const canManage = currentUserMembership?.canManageHome ?? false;

  const handleLeaveHome = async () => {
    if (!home) return;

    // Check if user is owner
    if (isOwner) {
      alertService.alert(
        t('homeDetail.ownerCannotLeaveTitle'),
        t('homeDetail.ownerCannotLeaveMessage'),
        [{ text: t('labels.ok') }],
      );
      return;
    }

    const success = await leaveHome(home.name ?? '');
    if (success) {
      goBack();
    }
  };

  if (loading || !home) {
    const getMessage = () => {
      if (loading) return t('homeDetail.loadingMessage');
      if (error) return t('homeDetail.errorFailedToLoad');
      return t('homeDetail.errorHomeNotFound');
    };

    return (
      <DetailTemplate
        title={t('homeDetail.title')}
        onBack={goBack}
        headerActions={[]}
        sections={[
          {
            content: (
              <View style={styles.loadingContainer}>
                <SousChefLoader
                  size="small"
                  showBrand={false}
                  message={getMessage()}
                />
                {!loading && !!error && (
                  <Button
                    title={t('labels.retry')}
                    onPress={() => refetch()}
                    variant="secondary"
                    style={styles.retryButton}
                  />
                )}
              </View>
            ),
          },
        ]}
      />
    );
  }

  // Edges from masked connections; node refs flow into the section's card
  // components which call `useFragment` per row for cache-subscribed updates.
  // `useFragment` types as `DeepPartialObject<...>` because writes may be
  // incomplete; in practice the query selects every field so it's safe to
  // narrow back to the section's expected node shape.
  type SectionMemberNode = React.ComponentProps<
    typeof HomeMembersSection
  >['members'][number];
  type SectionInviteNode = React.ComponentProps<
    typeof HomeMembersSection
  >['invites'][number];
  const memberNodes = (home.membersConnection?.edges
    ?.map(e => e?.node)
    .filter(Boolean) ?? []) as SectionMemberNode[];
  const inviteNodes = (home.invitesConnection?.edges
    ?.map(e => e?.node)
    .filter(Boolean) ?? []) as SectionInviteNode[];

  const sections = [
    {
      title: t('homeDetail.sectionHomeInformation'),
      content: (
        <>
          <EditableField
            label={t('homeDetail.labelHomeName')}
            value={home.name ?? ''}
            onSave={saveName}
            placeholder={t('homeDetail.placeholderHomeName')}
            readOnly={!canManage}
            validation={value => {
              if (!value.trim()) {
                return t('homeDetail.homeNameEmptyError');
              }
              return null;
            }}
          />
          {canManage ? (
            <SettingSwitch
              title={t('homeDetail.labelAllowJoinCode')}
              description={t('homeDetail.descriptionAllowJoinCode')}
              value={home.allowJoinCode ?? false}
              onValueChange={handleToggleJoinCode}
              disabled={joinCodeLoading}
              loading={joinCodeLoading}
              containerStyle={styles.joinCodeSwitch}
            />
          ) : null}
          {canManage && !!home.allowJoinCode && !!home.joinCode ? (
            <View style={styles.joinCodeRow}>
              <View style={styles.joinCodeContent}>
                <Text size="sm" tone="secondary" style={styles.joinCodeLabel}>
                  {t('homeDetail.labelJoinCode')}
                </Text>
                <Text size="lg" weight="semibold" style={styles.joinCodeValue}>
                  {home.joinCode}
                </Text>
              </View>
              <AppPressable
                style={styles.copyButton}
                onPress={handleCopyJoinCode}
                accessibilityLabel={t('homeDetail.labelJoinCode')}
              >
                <Icon
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={20}
                  tone={copied ? 'success' : 'textPrimary'}
                />
              </AppPressable>
              <AppPressable
                style={styles.copyButton}
                onPress={handleShareJoinLink}
                accessibilityLabel={t('homeDetail.shareLink')}
              >
                <Icon name="share-outline" size={20} tone="primary" />
              </AppPressable>
              <AppPressable
                style={styles.copyButton}
                onPress={handleRotateJoinCode}
                disabled={rotatingJoinCode}
                accessibilityLabel={t('homeDetail.rotateJoinCodeConfirm')}
              >
                <Icon name="refresh-outline" size={20} tone="textPrimary" />
              </AppPressable>
            </View>
          ) : null}
        </>
      ),
    },
    {
      title: t('homeDetail.sectionMembersInvites'),
      content: (
        <HomeMembersSection
          members={memberNodes}
          invites={inviteNodes}
          canManageHome={canManage}
          isOwner={isOwner}
          resolveMemberLabel={member => {
            const isCurrentUser =
              !!currentUser?.id && member.userId === currentUser.id;
            return {
              isCurrentUser,
              displayName: isCurrentUser
                ? t('homeDetail.youLabel')
                : getMemberDisplayName(
                    {
                      id: member.id,
                      role: member.role,
                      displayName: member.displayName,
                    },
                    currentUser?.id,
                  ),
            };
          }}
          resolveInviteLabel={invite =>
            getInviteDisplayName({ email: invite.email })
          }
          onChangeRole={changeRole}
          onRemove={removeMember}
          onTransferOwnership={handleTransferOwnership}
          onUpdatePermission={updateMemberPermission}
          onRevokeInvite={revokeInvite}
        />
      ),
    },
    {
      title: t('homeDetail.sectionStorage'),
      content: (
        <ThemedNavigationRow
          icon="folder-open"
          title={t('homeDetail.storageLocationsTitle')}
          subtitle={t('homeDetail.storageLocationsSubtitle')}
          onPress={() => toStorageLocations({ homeId })}
        />
      ),
    },
    // Only show Leave Home section for non-owners
    ...(!isOwner
      ? [
          {
            title: t('homeDetail.sectionDangerZone'),
            content: (
              <View style={styles.leaveHomeSection}>
                <Text
                  size="sm"
                  tone="secondary"
                  style={styles.leaveHomeDescription}
                >
                  {t('homeDetail.leaveHomeDescription')}
                </Text>
                <Button
                  title={t('homeDetail.leaveHomeButton')}
                  onPress={handleLeaveHome}
                  variant="danger"
                  loading={leaving}
                  disabled={leaving}
                />
              </View>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <DetailTemplate
        title={t('homeDetail.title')}
        onBack={goBack}
        headerActions={[]}
        sections={sections}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
      <ModalPicker
        visible={rolePickerState.visible}
        label={t('homeDetail.selectRoleLabel')}
        options={ROLE_OPTIONS}
        selected={rolePickerState.currentRole}
        onSelect={handleRoleSelect}
        onCancel={closeRolePicker}
        confirmLabel={t('labels.save')}
      />
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  retryButton: {
    marginTop: theme.spacing.md,
  },
  joinCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  joinCodeContent: {
    flex: 1,
  },
  joinCodeLabel: {
    marginBottom: theme.spacing.xs,
  },
  joinCodeValue: {
    letterSpacing: 2,
  },
  copyButton: {
    padding: theme.spacing.sm,
  },
  joinCodeSwitch: {
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  leaveHomeSection: {
    gap: theme.spacing.md,
  },
  leaveHomeDescription: {
    lineHeight: theme.fonts.size.sm * 1.5,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
