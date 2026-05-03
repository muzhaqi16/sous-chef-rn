import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { alertService } from '#/services/alertService';
import { Icon } from '#utils/iconUtils';
import { EmailInput } from '#components/atoms/EmailInput';
import { useNavigation } from '@react-navigation/native';
import { Header } from '#components/molecules/Header';
import { LoadingInline } from '#components/base/Loading';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Clipboard from '@react-native-clipboard/clipboard';
import { useMutation } from '@apollo/client/react';
import {
  RemoveCollaboratorDocument,
  AddCollaboratorDocument,
  ShareShoppingListDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
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

const ROLE_OPTIONS = INVITE_ROLES.map(role => ({
  key: role,
  label: `${ROLE_PERMISSIONS[role].icon} ${ROLE_PERMISSIONS[role].label}`,
}));

// PERFORMANCE: Helper functions moved outside component to avoid recreation on every render
const getStatusColor = (
  status: string,
  colors: {
    success: string;
    warning: string;
    error: string;
    textTertiary: string;
  },
): string => {
  switch (status?.toUpperCase()) {
    case 'ACCEPTED':
    case 'ACTIVE':
      return colors.success;
    case 'PENDING':
      return colors.warning;
    case 'DECLINED':
      return colors.error;
    case 'EXPIRED':
      return colors.textTertiary;
    default:
      return colors.textTertiary;
  }
};

const formatStatus = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'ACCEPTED':
    case 'ACTIVE':
      return 'Active';
    case 'PENDING':
      return 'Invited';
    case 'DECLINED':
      return 'Declined';
    case 'EXPIRED':
      return 'Expired';
    default:
      return status || 'Unknown';
  }
};

export const ShareList: React.FC<StaticScreenProps<{ listId: string }>> = ({
  route,
}) => {
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const { navigate } = useAppNavigation();
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
    collaborators,
    name: listName,
    refetch,
  } = useShoppingListDetails(listId);

  const isHomeLinked = !!shoppingList?.homeId;

  const [shareList] = useMutation(AddCollaboratorDocument);
  const [removeMember] = useMutation(RemoveCollaboratorDocument);
  const [shareShoppingList] = useMutation(ShareShoppingListDocument);

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
              'Failed to update share settings',
          );
        }
        // No refetch needed: the mutation returns shoppingList { id, shareCode, isPublic }
        // which Apollo normalizes by ShoppingList:${id}, auto-updating the cache.
      },
      setTogglingShareCode,
      error => {
        alertService.alert(
          'Error',
          error instanceof Error
            ? error.message
            : 'Failed to update share settings',
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
      alertService.alert('Error', 'Please enter an email address');
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
            data?.inviteToShoppingList?.message || 'Failed to send invitation',
          );
        }
        setEmail('');
        // No refetch needed: the update() callback above already inserts the
        // new collaborator into the cached collaboratorsConnection.
      },
      setSharing,
      error => {
        alertService.alert(
          'Error',
          error instanceof Error ? error.message : 'Failed to send invitation',
        );
      },
    );
  };

  const handleRemoveMember = (memberId: string) => {
    alertService.alert(
      'Remove Member',
      'Are you sure you want to remove this member?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
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
              alertService.alert('Error', 'Failed to remove member');
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
        'Cannot Leave',
        'Owners cannot leave the list. Please transfer ownership to another member or delete the list.',
        [{ text: 'OK' }],
      );
      return;
    }

    alertService.alert(
      'Leave Shopping List',
      `Are you sure you want to leave "${
        listName || 'this list'
      }"? You will lose access to this shared list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            if (!currentUserCollaborator?.id) {
              alertService.alert(
                'Error',
                'Could not determine your membership',
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
                navigation.goBack();
              },
              setLeaving,
              () => {
                alertService.alert('Error', 'Failed to leave list');
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
        title="Share List"
        onBack={() => navigation.goBack()}
        centerTitle
      />

      <OfflineGate
        message="Sharing not available offline"
        description="Connect to the internet to invite members or manage list sharing."
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
                title={`This list belongs to the home "${
                  shoppingList?.home?.name ?? 'Unknown'
                }". Members are managed through home settings.`}
                icon="home-outline"
                iconLibrary="Ionicons"
                variant="warning"
              />
              <View style={styles.homeLinkedButtonWrapper}>
                <Button
                  title="Manage Home"
                  onPress={() =>
                    navigate('HomeDetail', {
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
                <Text style={styles.sectionTitle}>Share via Code</Text>
                <Text style={styles.shareCodeDescription}>
                  Enable public sharing to generate a code anyone can use to
                  join this list.
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
                      color={
                        isPublic
                          ? theme.colors.primary
                          : theme.colors.textSecondary
                      }
                    />
                    <Text style={styles.shareCodeToggleText}>
                      {isPublic
                        ? 'Public sharing enabled'
                        : 'Public sharing disabled'}
                    </Text>
                  </Animated.View>
                  <View style={styles.toggleSlot}>
                    {togglingShareCode ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primary}
                      />
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
                          color={
                            copied ? theme.colors.success : theme.colors.primary
                          }
                        />
                        <Text
                          style={[
                            styles.copyText,
                            copied && { color: theme.colors.success },
                          ]}
                        >
                          {copied ? 'Copied' : 'Copy'}
                        </Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                ) : null}
              </View>

              <View style={styles.inviteSection}>
                <Text style={styles.sectionTitle}>Invite Members</Text>
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
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Icon name="send" size={20} color="white" />
                    )}
                  </Pressable>
                </View>
                <Text style={styles.roleLabel}>Role</Text>
                <ChipScrollRow
                  options={ROLE_OPTIONS}
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
              <Text style={styles.sectionTitle}>Current Members</Text>
              {activeCollaborators.map(member => {
                const statusColor = getStatusColor(member.status, theme.colors);
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
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: statusColor + '20',
                                borderColor: statusColor,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusText,
                                { color: statusColor },
                              ]}
                            >
                              {statusText}
                            </Text>
                          </View>
                          {!!member.invitedAt && (
                            <Text style={styles.invitedText}>
                              Invited{' '}
                              {new Date(member.invitedAt).toLocaleDateString()}
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
                        <Icon
                          name="close"
                          size={20}
                          color={theme.colors.error}
                        />
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
              <Text style={styles.sectionTitle}>Danger Zone</Text>
              <Text style={styles.leaveDescription}>
                Leaving this list will remove your access to all shared items.
              </Text>
              <Button
                title="Leave List"
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
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.semibold,
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
