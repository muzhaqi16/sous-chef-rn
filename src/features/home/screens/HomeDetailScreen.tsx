import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import type { StaticScreenProps } from '@react-navigation/native';
import { alertService } from '#/services/alertService';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import Clipboard from '@react-native-clipboard/clipboard';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  useHomeDetailManagement,
  ROLE_OPTIONS,
} from '#features/home/hooks/useHomeDetailManagement';

import { DetailTemplate } from '#components/templates/DetailTemplate';
import { ModalPicker } from '#components/molecules/ModalPicker';
import { EditableField } from '#components/molecules/EditableField';
import { NavigationRow } from '#components/molecules/NavigationRow';

const ThemedNavigationRow = withUnistyles(NavigationRow, theme => ({
  iconColor: theme.colors.primary,
}));
import { HomeMembersSection } from '#features/home/components/HomeMembersSection';
import { SettingSwitch } from '#components/settings/SettingSwitch';
import { useUser } from '#store/useAppStore';
import { Icon } from '#utils/iconUtils';
import { Button } from '#components/atoms/Button';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import {
  executeRefreshWithFinally,
  executeWriteWithFinally,
} from '#/utils/finallyHelpers';
import { logger } from '#/utils/environment';
import { SousChefLoader } from '#components/atoms/SousChefLoader';
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

  // Rotating the code invalidates every link already shared — confirm first.
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
    // A write, so the throw has to be surfaced: there is no query error state
    // behind this switch, and swallowing left the toggle snapping back with no
    // explanation.
    executeWriteWithFinally(
      () => toggleJoinCode(enabled),
      setJoinCodeLoading,
      error => {
        logger.error('Join-code toggle threw', { enabled, error });
        alertService.alert(t('labels.error'), t('errors.saveFailed'));
      },
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
        t('labels.cannotLeave'),
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

  // Gate on the absence of the home, not on `loading`. Under
  // `cache-and-network` Apollo reports `loading: true` for the whole network
  // leg on EVERY mount — `nextFetchPolicy` lives on the ObservableQuery and
  // useQuery builds a new one each time — so `loading ||` here threw the cached
  // home away and showed a spinner on every visit, for as long as the request
  // took.
  if (!home) {
    const getMessage = () => {
      if (loading) return t('labels.loading');
      if (error) return t('homeDetail.errorFailedToLoad');
      return t('errors.codes.homeNotFound');
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
            label={t('labels.homeName')}
            value={home.name ?? ''}
            onSave={saveName}
            placeholder={t('labels.enterHomeName')}
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
                accessibilityLabel={t('labels.shareLink')}
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
      title: t('labels.storage'),
      content: (
        <ThemedNavigationRow
          icon="folder-open"
          title={t('labels.storageLocations')}
          subtitle={t('homeDetail.storageLocationsSubtitle')}
          onPress={() => toStorageLocations({ homeId })}
        />
      ),
    },
    // Only show Leave Home section for non-owners
    ...(!isOwner
      ? [
          {
            title: t('labels.dangerZone'),
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
                  title={t('labels.leaveHome')}
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
        label={t('labels.selectRole')}
        options={ROLE_OPTIONS.map(role => ({
          label: t(role.labelKey),
          value: role.value,
        }))}
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
    paddingVertical: theme.spacing['3xl'],
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
    borderBottomWidth: theme.borderWidth.none,
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
