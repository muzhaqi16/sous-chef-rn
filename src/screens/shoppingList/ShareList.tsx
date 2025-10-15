import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
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

export const ShareList: React.FC = () => {
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const route = useRoute();
  const { listId } = route.params as { listId: string };

  const [email, setEmail] = useState('');
  const [sharing, setSharing] = useState(false);

  const { loading, collaborators, refetch } = useShoppingListDetails(listId);

  const [shareList] = useAddCollaboratorMutation();
  const [removeMember] = useRemoveCollaboratorMutation();

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
    } catch (error) {
      Alert.alert('Error', 'Failed to send invitation');
    } finally {
      setSharing(false);
    }
  };

  const handleRemoveMember = (email: string) => {
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
                  data: { shoppingListId: listId, email },
                },
              });
              refetch();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove member');
            }
          },
        },
      ],
    );
  };

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

      <View style={styles.membersSection}>
        <Text style={styles.sectionTitle}>Current Members</Text>
        <ScrollView>
          {collaborators.map((member: any) => {
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

            const statusColor = getStatusColor(member.status);
            const statusText = formatStatus(member.status);

            return (
              <View key={member.id} style={styles.memberCard}>
                <View style={styles.memberInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {member.name?.[0]?.toUpperCase() ||
                        member.email[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.memberDetails}>
                    <Text style={styles.memberName}>
                      {member.name || member.email}
                    </Text>
                    <Text style={styles.memberEmail}>{member.email}</Text>
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
                          style={[styles.statusText, { color: statusColor }]}
                        >
                          {statusText}
                        </Text>
                      </View>
                      {member.invitedAt && (
                        <Text style={styles.invitedText}>
                          Invited{' '}
                          {new Date(member.invitedAt).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveMember(member.email)}
                >
                  <Icon name="close" size={20} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      </View>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 24,
  },
  inviteSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  sendButton: {
    marginLeft: 12,
    backgroundColor: theme.colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  membersSection: {
    padding: 16,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'white',
    marginBottom: 8,
    borderRadius: 8,
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
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  memberEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  invitedText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
}));
