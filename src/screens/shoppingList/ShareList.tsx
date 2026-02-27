import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  ActivityIndicator } from 'react-native';
import { Icon } from '#utils/iconUtils';
import { useNavigation } from '@react-navigation/native';
import { Header } from '#components/molecules/Header';
import { LoadingInline } from '#components/base/Loading';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  useRemoveCollaboratorMutation,
  useAddCollaboratorMutation,
  CollaboratorRole } from '#generated';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { useShoppingListDetails } from '#hooks/shoppingList/useShoppingListDetails';
import CollaboratorPermissionsBottomSheet, {
  CollaboratorPermissionsBottomSheetRef } from '#/components/organisms/CollaboratorPermissionsBottomSheet';
import { useAppStore, selectUser } from '#store/useAppStore';
import { Button } from '#components/base/Button';
import { OfflineGate } from '#components/atoms/OfflineGate';

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

// PERFORMANCE: Helper functions moved outside component to avoid recreation on every render
const getStatusColor = (status: string, colors: { success: string; warning: string; error: string; textTertiary: string }): string => {
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

export const ShareList: React.FC<StaticScreenProps<{ listId: string }>> = ({ route }) => {
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const { listId } = route.params;

  const [email, setEmail] = useState('');
  const [sharing, setSharing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const permissionsBottomSheetRef =
    useRef<CollaboratorPermissionsBottomSheetRef>(null);

  // Get current user to check if they are owner
  const currentUser = useAppStore(selectUser);

  const {
    loading,
    isRefetching,
    collaborators,
    name: listName,
    refetch } = useShoppingListDetails(listId);

  const [shareList] = useAddCollaboratorMutation();
  const [removeMember] = useRemoveCollaboratorMutation();

  // Check if current user is owner
  const currentUserCollaborator = collaborators.find(
    c => c.email === currentUser?.email || c.collaboratorId === currentUser?.id,
  );
  const isOwner = currentUserCollaborator?.role === CollaboratorRole.Owner;

  const activeCollaborators = collaborators.filter(c =>
    ['ACCEPTED', 'ACTIVE', 'PENDING'].includes(c.status?.toUpperCase()),
  );

  const handleShare = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setSharing(true);
    try {
      await shareList({
        variables: {
          input: {
            shoppingListId: listId,
            email: email.trim(),
            role: CollaboratorRole.Contributor, // Assuming a role is required
          } },
        update(cache, { data }) {
          const collaborator = data?.inviteToShoppingList?.collaborator;
          if (collaborator) {
            addCollaboratorToCache(cache, listId, collaborator, { position: 'end' });
          }
        } });
      setEmail('');
      refetch();
    } catch {
      Alert.alert('Error', 'Failed to send invitation');
    } finally {
      setSharing(false);
    }
  };

  const handleRemoveMember = (memberId: string) => {
      Alert.alert(
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
                    removeCollaboratorFromCache(cache, listId, memberId, { evictItem: true });
                  } });
                refetch();
              } catch {
                Alert.alert('Error', 'Failed to remove member');
              }
            } },
        ],
      );
    };

  const handleLeaveList = () => {
    // Block owners from leaving
    if (isOwner) {
      Alert.alert(
        'Cannot Leave',
        'Owners cannot leave the list. Please transfer ownership to another member or delete the list.',
        [{ text: 'OK' }],
      );
      return;
    }

    Alert.alert(
      'Leave Shopping List',
      `Are you sure you want to leave "${
        listName || 'this list'
      }"? You will lose access to this shared list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (!currentUserCollaborator?.id) {
              Alert.alert('Error', 'Could not determine your membership');
              return;
            }

            setLeaving(true);
            try {
              await removeMember({
                variables: { id: currentUserCollaborator.id },
                update(cache) {
                  removeCollaboratorFromCache(cache, listId, currentUserCollaborator.id, { evictItem: true });
                } });
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Failed to leave list');
            } finally {
              setLeaving(false);
            }
          } },
      ],
    );
  };

  if (loading) {
    return <LoadingInline />;
  }

  return (
    <View style={styles.container}>
      <Header title="Share List" onBack={() => navigation.goBack()} centerTitle />

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
          <View style={styles.inviteSection}>
            <Text style={styles.sectionTitle}>Invite Members</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter email address"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Pressable
                style={({pressed}) => [styles.sendButton, pressed && styles.pressed]}
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
          </View>

          {activeCollaborators.length > 0 && (
            <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>Current Members</Text>
              {activeCollaborators.map(member => {
                const statusColor = getStatusColor(member.status, theme.colors);
                const statusText = formatStatus(member.status);
                return (
                  <Pressable
                    key={member.id}
                    style={({pressed}) => [styles.memberCard, pressed && styles.pressed]}
                    onPress={() => permissionsBottomSheetRef.current?.open(member)}
                  >
                    <View style={styles.memberInfo}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {member.email?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={styles.memberDetails}>
                        <Text style={styles.memberName}>{member.email || 'Unknown'}</Text>
                        <Text style={styles.memberEmail}>{member.email || ''}</Text>
                        <View style={styles.statusContainer}>
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: statusColor + '20',
                                borderColor: statusColor },
                            ]}
                          >
                            <Text style={[styles.statusText, { color: statusColor }]}>
                              {statusText}
                            </Text>
                          </View>
                          {!!member.invitedAt && (
                            <Text style={styles.invitedText}>
                              Invited {new Date(member.invitedAt).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                    <Pressable
                      onPress={e => {
                        e?.stopPropagation?.();
                        if (member.id) {
                          handleRemoveMember(member.id);
                        }
                      }}
                      style={({pressed}) => pressed && styles.pressed}
                    >
                      <Icon name="close" size={20} color={theme.colors.error} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Leave List section - only show for non-owners who are collaborators */}
          {!!currentUserCollaborator && !isOwner && (
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
    backgroundColor: theme.colors.background },
  scrollContent: {
    flexGrow: 1 },
  inviteSection: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border },
  sectionTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing['3'] },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary },
  sendButton: {
    marginLeft: theme.spacing['3'],
    backgroundColor: theme.colors.primary,
    width: 44,
    height: 44,
    borderRadius: theme.radii.full,
    justifyContent: 'center',
    alignItems: 'center' },
  membersSection: {
    padding: theme.spacing.md },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing['3'],
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radii.sm },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1 },
  memberDetails: {
    flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing['3'] },
  avatarText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold },
  memberName: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary },
  memberEmail: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2 },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    flexWrap: 'wrap',
    gap: theme.spacing.sm },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    borderWidth: 1 },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.semibold },
  invitedText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    fontStyle: 'italic' },
  leaveSection: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 'auto',
    gap: theme.spacing.md },
  leaveDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.fontSize.sm * 1.5 },
  pressed: {
    opacity: theme.opacity.pressed } }));
