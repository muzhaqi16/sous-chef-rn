import React, { useState, useRef, useEffect } from 'react';
import { View, Text, RefreshControl, ScrollView } from 'react-native';
import {
  Pressable,
  PrimaryActivityIndicator,
  WhiteActivityIndicator,
} from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { Icon } from '#utils/iconUtils';
import { useTranslation } from 'react-i18next';
import { EmailInput } from '#components/atoms/EmailInput';
import { useNavigation } from '@react-navigation/native';
import { Header } from '#components/molecules/Header';
import { LoadingInline } from '#components/base/Loading';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import Clipboard from '@react-native-clipboard/clipboard';
import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  RemoveCollaboratorDocument,
  AddCollaboratorDocument,
  ShareShoppingListDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  ShoppingListCollaboratorFragmentDoc,
  type ShoppingListCollaboratorFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { useShoppingListDetails } from '#features/shoppingList/hooks/useShoppingListDetails';
import CollaboratorPermissionsBottomSheet, {
  CollaboratorPermissionsBottomSheetRef,
} from '#/components/organisms/CollaboratorPermissionsBottomSheet';
import { useUser } from '#store/useAppStore';
import { Button } from '#components/base/Button';
import { OfflineGate } from '#components/atoms/OfflineGate';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { ROLE_PERMISSIONS, INVITE_ROLES } from '#/constants/collaboratorRoles';
import { ChipScrollRow } from '#components/atoms/ChipScrollRow';
import { getCollaboratorDisplayName } from '#/utils/formatters/memberFormatters';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getFormAnimationPreset } from '#/constants/animations';

const addCollaboratorToCache = createAddToParentConnectionUpdater(
  'ShoppingList',
  'collaboratorsConnection',
  'ShoppingListCollaborator',
);

const removeCollaboratorFromCache = createRemoveFromParentConnectionUpdater(
  'ShoppingList',
  'collaboratorsConnection',
  'ShoppingListCollaborator',
);

const ROLE_LABEL_KEYS: Record<CollaboratorRole, string> = {
  [CollaboratorRole.Viewer]: 'collaboratorRoles.viewer',
  [CollaboratorRole.Shopper]: 'collaboratorRoles.shopper',
  [CollaboratorRole.Contributor]: 'collaboratorRoles.contributor',
  [CollaboratorRole.Editor]: 'collaboratorRoles.editor',
  [CollaboratorRole.Admin]: 'collaboratorRoles.admin',
  [CollaboratorRole.Owner]: 'collaboratorRoles.owner',
};

const buildRoleOptions = (t: T) =>
  INVITE_ROLES.map(role => ({
    key: role,
    icon: ROLE_PERMISSIONS[role].icon,
    label: t(ROLE_LABEL_KEYS[role]),
  }));

type StatusVariant = 'active' | 'pending' | 'declined' | 'expired';

const getStatusVariant = (status: string): StatusVariant => {
  switch (status?.toUpperCase()) {
    case 'ACCEPTED':
    case 'ACTIVE':
      return 'active';
    case 'PENDING':
      return 'pending';
    case 'DECLINED':
      return 'declined';
    case 'EXPIRED':
    default:
      return 'expired';
  }
};

function StatusBadge({
  variant,
  text,
}: {
  variant: StatusVariant;
  text: string;
}) {
  styles.useVariants({ status: variant });
  return (
    <View style={styles.statusBadge}>
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

type T = (key: string, opts?: Record<string, unknown>) => string;

const getFormatStatus = (t: T) => (status: string) => {
  switch (status?.toUpperCase()) {
    case 'ACCEPTED':
    case 'ACTIVE':
      return t('shoppingListScreens.statusActive');
    case 'PENDING':
      return t('shoppingListScreens.statusInvited');
    case 'DECLINED':
      return t('shoppingListScreens.statusDeclined');
    case 'EXPIRED':
      return t('shoppingListScreens.statusExpired');
    default:
      return status || t('shoppingListScreens.statusUnknown');
  }
};

export const ShareList: React.FC<StaticScreenProps<{ listId: string }>> = ({
  route,
}) => {
  const { t } = useTranslation();
  const formatStatus = getFormatStatus(t);
  const roleOptions = buildRoleOptions(t);
  const { goBack } = useNavigation();
  const { toHomeDetail } = useAppNavigation();
  const { listId } = route.params;

  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<CollaboratorRole>(
    CollaboratorRole.Contributor,
  );
  const [sharing, setSharing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [togglingShareCode, setTogglingShareCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const permissionsBottomSheetRef =
    useRef<CollaboratorPermissionsBottomSheetRef>(null);

  // Get current user to check if they are owner
  const currentUser = useUser();

  const {
    shoppingList,
    loading,
    isRefetching,
    collaborators: collaboratorRefs,
    name: listName,
    refetch,
  } = useShoppingListDetails(listId);

  const isHomeLinked = !!shoppingList?.homeId;

  const apolloClient = useApolloClient();

  const [shareList] = useMutation(AddCollaboratorDocument);
  const [removeMember] = useMutation(RemoveCollaboratorDocument);
  const [shareShoppingList] = useMutation(ShareShoppingListDocument);

  // Materialize the masked ShoppingListCollaborator fragment refs once so we
  // can read fields (id, email, role, status, ...) needed for owner detection,
  // filtering, and rendering. Each edge also carries `invitedAt` directly on
  // its selection, which we preserve alongside the materialized fragment.
  const collaborators = collaboratorRefs
    .map(ref => {
      const fragment =
        apolloClient.cache.readFragment<ShoppingListCollaboratorFragment>({
          fragment: ShoppingListCollaboratorFragmentDoc,
          fragmentName: 'ShoppingListCollaboratorFragment',
          from: ref,
        });
      if (!fragment) return null;
      return { ...fragment, invitedAt: ref.invitedAt };
    })
    .filter(
      (c): c is ShoppingListCollaboratorFragment & { invitedAt: string } =>
        c !== null,
    );

  // Check if current user is owner
  const currentUserCollaborator = collaborators.find(
    c => c.email === currentUser?.email || c.collaboratorId === currentUser?.id,
  );
  const isOwner = currentUserCollaborator?.role === CollaboratorRole.Owner;

  const activeCollaborators = collaborators.filter(c =>
    ['ACCEPTED', 'ACTIVE', 'PENDING'].includes(c.status?.toUpperCase()),
  );

  const isPublic = !!shoppingList?.isPublic;
  const shareCode = shoppingList?.shareCode;

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const [prevShareCode, setPrevShareCode] = useState(shareCode);
  if (shareCode !== prevShareCode) {
    setPrevShareCode(shareCode);
    setCopied(false);
  }

  const handleToggleShareCode = () => {
    executeWithLoadingState(
      async () => {
        const { data } = await shareShoppingList({
          variables: {
            id: listId,
            input: { isPublic: !isPublic },
          },
        });
        if (!data?.shareShoppingList?.success) {
          throw new Error(
            data?.shareShoppingList?.message ||
              t('shoppingListScreens.failedToUpdateShareSettings'),
          );
        }
        // No refetch needed: the mutation returns shoppingList { id, shareCode, isPublic }
        // which Apollo normalizes by ShoppingList:${id}, auto-updating the cache.
      },
      setTogglingShareCode,
      error => {
        alertService.alert(
          t('labels.error'),
          error instanceof Error
            ? error.message
            : t('shoppingListScreens.failedToUpdateShareSettings'),
        );
      },
    );
  };

  const handleCopyShareCode = () => {
    if (shareCode) {
      Clipboard.setString(shareCode);
      setCopied(true);
    }
  };

  const handleShare = () => {
    if (!email.trim()) {
      alertService.alert(
        t('labels.error'),
        t('shoppingListScreens.pleaseEnterEmail'),
      );
      return;
    }

    executeWithLoadingState(
      async () => {
        const { data } = await shareList({
          variables: {
            input: {
              shoppingListId: listId,
              email: email.trim(),
              role: selectedRole,
            },
          },
          update(cache, { data: updateData }) {
            const collaborator = updateData?.inviteToShoppingList?.collaborator;
            if (collaborator) {
              addCollaboratorToCache(cache, listId, collaborator, {
                position: 'end',
              });
            }
          },
        });
        if (!data?.inviteToShoppingList?.success) {
          throw new Error(
            data?.inviteToShoppingList?.message ||
              t('shoppingListScreens.failedToSendInvitation'),
          );
        }
        setEmail('');
        // No refetch needed: the update() callback above already inserts the
        // new collaborator into the cached collaboratorsConnection.
      },
      setSharing,
      error => {
        alertService.alert(
          t('labels.error'),
          error instanceof Error
            ? error.message
            : t('shoppingListScreens.failedToSendInvitation'),
        );
      },
    );
  };

  const handleRemoveMember = (memberId: string) => {
    alertService.alert(
      t('shoppingListScreens.removeMemberTitle'),
      t('shoppingListScreens.removeMemberMessage'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember({
                variables: { id: memberId },
                update(cache) {
                  removeCollaboratorFromCache(cache, listId, memberId, {
                    evictItem: true,
                  });
                },
              });
              // No refetch needed: the update() callback removes the
              // collaborator from the cached connection in place.
            } catch {
              alertService.alert(
                t('labels.error'),
                t('shoppingListScreens.failedToRemoveMember'),
              );
            }
          },
        },
      ],
    );
  };

  const handleLeaveList = () => {
    // Block owners from leaving
    if (isOwner) {
      alertService.alert(
        t('shoppingListScreens.cannotLeaveTitle'),
        t('shoppingListScreens.cannotLeaveOwnerMessage'),
        [{ text: t('storageLocations.ok') }],
      );
      return;
    }

    alertService.alert(
      t('shoppingListScreens.leaveListTitle'),
      t('shoppingListScreens.leaveListMessage', {
        name: listName || t('shoppingListScreens.thisList'),
      }),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('shoppingListScreens.leaveList'),
          style: 'destructive',
          onPress: () => {
            if (!currentUserCollaborator?.id) {
              alertService.alert(
                t('labels.error'),
                t('shoppingListScreens.couldNotDetermineMembership'),
              );
              return;
            }

            executeWithLoadingState(
              async () => {
                await removeMember({
                  variables: { id: currentUserCollaborator.id },
                  update(cache) {
                    removeCollaboratorFromCache(
                      cache,
                      listId,
                      currentUserCollaborator.id,
                      { evictItem: true },
                    );
                  },
                });
                goBack();
              },
              setLeaving,
              () => {
                alertService.alert(
                  t('labels.error'),
                  t('shoppingListScreens.failedToLeave'),
                );
              },
            );
          },
        },
      ],
    );
  };

  // Only block the UI on the initial cold load. usePreservedQueryData keeps
  // shoppingList truthy across refetches, so this avoids the full-screen flash
  // every time a mutation triggers a refetch.
  if (loading && !shoppingList) {
    return <LoadingInline />;
  }

  return (
    <View style={styles.container}>
      <Header
        title={t('shoppingListScreens.shareTitle')}
        onBack={() => goBack()}
        centerTitle
      />

      <OfflineGate
        message={t('shoppingListScreens.sharingOfflineMessage')}
        description={t('shoppingListScreens.sharingOfflineDescription')}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
        >
          {isHomeLinked ? (
            <View style={styles.homeLinkedSection}>
              <AlertBanner
                title={t('shoppingListScreens.shareHomeLinkedNotice', {
                  name:
                    shoppingList?.home?.name ??
                    t('shoppingListScreens.ownerUnknown'),
                })}
                icon="home-outline"
                iconLibrary="Ionicons"
                variant="warning"
              />
              <View style={styles.homeLinkedButtonWrapper}>
                <Button
                  title={t('shoppingListScreens.manageHome')}
                  onPress={() =>
                    toHomeDetail({
                      homeId: shoppingList?.homeId ?? '',
                    })
                  }
                  variant="secondary"
                  icon="people-outline"
                />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.shareCodeSection}>
                <Text style={styles.sectionTitle}>
                  {t('shoppingListScreens.shareViaCode')}
                </Text>
                <Text style={styles.shareCodeDescription}>
                  {t('shoppingListScreens.shareCodeDescription')}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.shareCodeToggle,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleToggleShareCode}
                  disabled={togglingShareCode}
                >
                  <Animated.View
                    key={isPublic ? 'public-on' : 'public-off'}
                    entering={FadeIn.duration(200)}
                    style={styles.shareCodeToggleContent}
                  >
                    <Icon
                      name={isPublic ? 'link-outline' : 'lock-closed-outline'}
                      size={20}
                      tone={isPublic ? 'primary' : 'textSecondary'}
                    />
                    <Text style={styles.shareCodeToggleText}>
                      {isPublic
                        ? t('shoppingListScreens.publicSharingEnabled')
                        : t('shoppingListScreens.publicSharingDisabled')}
                    </Text>
                  </Animated.View>
                  <View style={styles.toggleSlot}>
                    {togglingShareCode ? (
                      <PrimaryActivityIndicator size="small" />
                    ) : (
                      <View
                        style={[
                          styles.toggleTrack,
                          isPublic && styles.toggleTrackActive,
                        ]}
                      >
                        <View
                          style={[
                            styles.toggleThumb,
                            isPublic && styles.toggleThumbActive,
                          ]}
                        />
                      </View>
                    )}
                  </View>
                </Pressable>
                {isPublic && shareCode ? (
                  <Animated.View {...getFormAnimationPreset()}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.shareCodeDisplay,
                        pressed && styles.pressed,
                      ]}
                      onPress={handleCopyShareCode}
                    >
                      <Text style={styles.shareCodeValue}>{shareCode}</Text>
                      <View style={styles.copyButton}>
                        <Icon
                          name={copied ? 'checkmark' : 'copy-outline'}
                          size={18}
                          tone={copied ? 'success' : 'primary'}
                        />
                        <Text
                          style={[
                            styles.copyText,
                            copied && styles.copyTextCopied,
                          ]}
                        >
                          {copied
                            ? t('shoppingListScreens.copied')
                            : t('shoppingListScreens.copy')}
                        </Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                ) : null}
              </View>

              <View style={styles.inviteSection}>
                <Text style={styles.sectionTitle}>
                  {t('shoppingListScreens.inviteMembers')}
                </Text>
                <View style={styles.inputRow}>
                  <EmailInput
                    containerStyle={styles.emailInputContainer}
                    value={email}
                    onChangeText={setEmail}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.sendButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={handleShare}
                    disabled={sharing}
                  >
                    {sharing ? (
                      <WhiteActivityIndicator size="small" />
                    ) : (
                      <Icon name="send" size={20} tone="white" />
                    )}
                  </Pressable>
                </View>
                <Text style={styles.roleLabel}>
                  {t('shoppingListScreens.role')}
                </Text>
                <ChipScrollRow
                  options={roleOptions}
                  selected={selectedRole}
                  onSelect={setSelectedRole}
                  size="md"
                  style={styles.chipScroll}
                  contentContainerStyle={styles.chipRowContent}
                />
              </View>
            </>
          )}

          {activeCollaborators.length > 0 && (
            <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>
                {t('shoppingListScreens.currentMembers')}
              </Text>
              {activeCollaborators.map(member => {
                const statusVariant = getStatusVariant(member.status);
                const statusText = formatStatus(member.status);
                const displayName = getCollaboratorDisplayName(
                  member,
                  currentUser?.id,
                );
                const memberEmail =
                  member.collaborator?.email ?? member.email ?? '';
                const showEmailRow =
                  !!memberEmail && memberEmail !== displayName;
                return (
                  <Pressable
                    key={member.id}
                    style={({ pressed }) => [
                      styles.memberCard,
                      pressed && styles.pressed,
                    ]}
                    onPress={() =>
                      permissionsBottomSheetRef.current?.open(member)
                    }
                  >
                    <View style={styles.memberInfo}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {displayName[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={styles.memberDetails}>
                        <Text style={styles.memberName}>{displayName}</Text>
                        {showEmailRow ? (
                          <Text style={styles.memberEmail}>{memberEmail}</Text>
                        ) : null}
                        <View style={styles.statusContainer}>
                          <StatusBadge
                            variant={statusVariant}
                            text={statusText}
                          />
                          {!!member.invitedAt && (
                            <Text style={styles.invitedText}>
                              {t('shoppingListScreens.invitedOn', {
                                date: new Date(
                                  member.invitedAt,
                                ).toLocaleDateString(),
                              })}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                    {!isHomeLinked && (
                      <Pressable
                        onPress={() => {
                          if (member.id) {
                            handleRemoveMember(member.id);
                          }
                        }}
                        style={({ pressed }) => pressed && styles.pressed}
                      >
                        <Icon name="close" size={20} tone="error" />
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Leave List section - only show for non-owners who are collaborators on non-home-linked lists */}
          {!!currentUserCollaborator && !isOwner && !isHomeLinked && (
            <View style={styles.leaveSection}>
              <Text style={styles.sectionTitle}>
                {t('shoppingListScreens.dangerZone')}
              </Text>
              <Text style={styles.leaveDescription}>
                {t('shoppingListScreens.leaveDescription')}
              </Text>
              <Button
                title={t('shoppingListScreens.leaveList')}
                onPress={handleLeaveList}
                variant="danger"
                loading={leaving}
                disabled={leaving}
              />
            </View>
          )}
        </ScrollView>

        <CollaboratorPermissionsBottomSheet
          ref={permissionsBottomSheetRef}
          shoppingListId={listId}
          onSuccess={refetch}
        />
      </OfflineGate>
    </View>
  );
};
const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  homeLinkedSection: {
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  homeLinkedButtonWrapper: {
    paddingHorizontal: theme.spacing.md,
  },
  inviteSection: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing['3'],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emailInputContainer: {
    flex: 1,
  },
  sendButton: {
    marginLeft: theme.spacing['3'],
    backgroundColor: theme.colors.primary,
    width: 44,
    height: 44,
    borderRadius: theme.radii.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  chipScroll: {
    marginHorizontal: -theme.spacing.md,
  },
  chipRowContent: {
    paddingHorizontal: theme.spacing.md,
  },
  shareCodeSection: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  shareCodeDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  shareCodeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing['3'],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
  },
  shareCodeToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  shareCodeToggleText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
    fontWeight: theme.fonts.weight.medium,
  },
  toggleSlot: {
    width: 44,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.white,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  shareCodeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    padding: theme.spacing['3'],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  shareCodeValue: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  copyText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
  copyTextCopied: {
    color: theme.colors.success,
  },
  membersSection: {
    padding: theme.spacing.md,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing['3'],
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radii.sm,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  memberDetails: {
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing['3'],
  },
  avatarText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  memberName: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  memberEmail: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    variants: {
      status: {
        active: {
          backgroundColor: theme.colors.success + '20',
          borderColor: theme.colors.success,
        },
        pending: {
          backgroundColor: theme.colors.warning + '20',
          borderColor: theme.colors.warning,
        },
        declined: {
          backgroundColor: theme.colors.error + '20',
          borderColor: theme.colors.error,
        },
        expired: {
          backgroundColor: theme.colors.textTertiary + '20',
          borderColor: theme.colors.textTertiary,
        },
      },
    },
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.semibold,
    variants: {
      status: {
        active: { color: theme.colors.success },
        pending: { color: theme.colors.warning },
        declined: { color: theme.colors.error },
        expired: { color: theme.colors.textTertiary },
      },
    },
  },
  invitedText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  leaveSection: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 'auto',
    gap: theme.spacing.md,
  },
  leaveDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
