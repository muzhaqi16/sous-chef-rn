import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Icon } from '#utils/iconUtils';
import { useNavigation } from '@react-navigation/native';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  useRemoveCollaboratorMutation,
  useAddCollaboratorMutation,
  CollaboratorRole,
} from '#generated';
import { useShoppingListDetails } from '#hooks/shoppingList/useShoppingListDetails';
import CollaboratorPermissionsBottomSheet, {
  CollaboratorPermissionsBottomSheetRef,
} from '#/components/organisms/CollaboratorPermissionsBottomSheet';
import { useAppStore, selectUser } from '#store/useAppStore';
import { Button } from '#components/base/Button';
import { OfflineGate } from '#components/atoms/OfflineGate';

// PERFORMANCE: Helper functions moved outside component to avoid recreation on every render
const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'ACCEPTED':
    case 'ACTIVE':
      return '#4CAF50'; // Green
    case 'PENDING':
      return '#FFA500'; // Orange
    case 'DECLINED':
      return '#F44336'; // Red
    case 'EXPIRED':
      return '#9E9E9E'; // Gray
    default:
      return '#9E9E9E';
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
    refetch,
  } = useShoppingListDetails(listId);

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
          },
        },
      });
      setEmail('');
      refetch();
    } catch {
      Alert.alert('Error', 'Failed to send invitation');
    } finally {
      setSharing(false);
    }
  };

  const handleRemoveMember = useCallback(
    (memberId: string) => {
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
                });
                refetch();
              } catch {
                Alert.alert('Error', 'Failed to remove member');
              }
            },
          },
        ],
      );
    },
    [removeMember, refetch],
  );

  const handleLeaveList = useCallback(() => {
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
              });
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Failed to leave list');
            } finally {
              setLeaving(false);
            }
          },
        },
      ],
    );
  }, [isOwner, listName, currentUserCollaborator?.id, removeMember, navigation]);

  // PERFORMANCE: Memoized renderItem to avoid recreating on every render
  const renderMemberItem = useCallback(
    ({ item: member }: { item: any }) => {
      const statusColor = getStatusColor(member.status);
      const statusText = formatStatus(member.status);

      return (
        <Pressable
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
                      borderColor: statusColor,
                    },
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
    },
    [handleRemoveMember, theme.colors.error],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={({pressed}) => pressed && styles.pressed}>
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Share List</Text>
        <View style={styles.placeholder} />
      </View>

      <OfflineGate
        message="Sharing not available offline"
        description="Connect to the internet to invite members or manage list sharing."
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
        {/* Only show if there are any members */}
        {activeCollaborators.length > 0 && (
          <View style={styles.membersSection}>
            <Text style={styles.sectionTitle}>Current Members</Text>
            <FlashList
              data={activeCollaborators}
              keyExtractor={member => member.id}
              renderItem={renderMemberItem}
              refreshing={isRefetching}
              onRefresh={refetch}
            />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 24,
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
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
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
