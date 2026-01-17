import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Icon } from '#utils';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  useRemoveCollaboratorMutation,
  useAddCollaboratorMutation,
  CollaboratorRole,
} from '#generated';
import { useShoppingListDetails } from '#/hooks';
import CollaboratorPermissionsBottomSheet, {
  CollaboratorPermissionsBottomSheetRef,
} from '#/components/organisms/CollaboratorPermissionsBottomSheet';
import { useAppStore, selectUser } from '#store/useAppStore';
import { Button } from '#components/base';
import { OfflineGate } from '#components/atoms';

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

export const ShareList: React.FC = () => {
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const route = useRoute();
  const { listId } = route.params as { listId: string };

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

  const handleShare = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setSharing(true);
    try {
      await shareList({
        variables: {
          data: {
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
    (memberEmail: string) => {
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
                  variables: {
                    data: { shoppingListId: listId, email: memberEmail },
                  },
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
    [listId, removeMember, refetch],
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
            if (!currentUser?.email) {
              Alert.alert('Error', 'Could not determine your email');
              return;
            }

            setLeaving(true);
            try {
              await removeMember({
                variables: {
                  data: { shoppingListId: listId, email: currentUser.email },
                },
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
  }, [isOwner, listName, currentUser?.email, listId, removeMember, navigation]);

  // PERFORMANCE: Memoized renderItem to avoid recreating on every render
  const renderMemberItem = useCallback(
    ({ item: member }: { item: any }) => {
      const statusColor = getStatusColor(member.status);
      const statusText = formatStatus(member.status);

      return (
        <TouchableOpacity
          style={styles.memberCard}
          onPress={() => permissionsBottomSheetRef.current?.open(member)}
          activeOpacity={0.7}
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
                {member.invitedAt && (
                  <Text style={styles.invitedText}>
                    Invited {new Date(member.invitedAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </View>
          </View>
          <TouchableOpacity
            onPress={e => {
              e?.stopPropagation?.();
              if (member.email) {
                handleRemoveMember(member.email);
              }
            }}
          >
            <Icon name="close" size={20} color={theme.colors.error} />
          </TouchableOpacity>
        </TouchableOpacity>
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
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
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleShare}
              disabled={sharing}
            >
              {sharing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Icon name="send" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
        {/* Only show if there are any members */}
        {collaborators.length > 0 && (
          <View style={styles.membersSection}>
            <Text style={styles.sectionTitle}>Current Members</Text>
            <FlatList
              data={collaborators}
              keyExtractor={member => member.id}
              renderItem={renderMemberItem}
              refreshing={isRefetching}
              onRefresh={refetch}
            />
          </View>
        )}

        {/* Leave List section - only show for non-owners who are collaborators */}
        {currentUserCollaborator && !isOwner && (
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
  },
  memberName: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '500',
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
    fontWeight: '600',
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
}));
