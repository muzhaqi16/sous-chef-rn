import React from 'react';
import {View, Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useStore} from '#store';
import {HomeInviteFragment} from '#generated';

interface Member {
  id: string;
  role: string;
  status: string;
  userId?: string;
  displayName?: string;
  user?: {
    id: string;
    email?: string;
    profile?: {
      firstName?: string;
      lastName?: string;
      displayName?: string;
    };
  };
}

interface Invite {
  id: string;
  email: string;
  recipientName?: string;
  role: string;
  status: string;
  sentAt?: string;
  acceptedAt?: string;
  declinedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
  inviter?: {
    id: string;
    email?: string;
    profile?: {
      displayName?: string;
    };
  };
}

interface MembersListProps {
  members: Member[];
  invites?: HomeInviteFragment[];
}

export const MembersList: React.FC<MembersListProps> = ({members, invites = []}) => {
  const currentUser = useStore(state => state.user);
  
  // Filter out accepted invites since they are now members
  const pendingInvites = invites.filter(invite => invite.status !== 'ACCEPTED');
  
  if ((!members || members.length === 0) && (!pendingInvites || pendingInvites.length === 0)) return null;

  const getMemberDisplayName = (member: Member): string => {
    // Check if this member is the current user
    const isCurrentUser = member.user?.id === currentUser?.id;
    
    if (isCurrentUser) {
      return 'You';
    }
    
    // Try to get display name in order of preference
    const displayName = 
      member.displayName ||
      member.user?.profile?.displayName ||
      member.user?.profile?.firstName ||
      (member.user?.profile?.firstName && member.user?.profile?.lastName 
        ? `${member.user.profile.firstName} ${member.user.profile.lastName}` 
        : null) ||
      member.user?.email?.split('@')[0] || // Use email username part
      member.user?.email ||
      'Unknown Member';
    
    return displayName;
  };

  const formatRole = (role: string): string => {
    switch (role) {
      case 'OWNER':
        return 'Owner';
      case 'ADMIN':
        return 'Admin';
      case 'MEMBER':
        return 'Member';
      case 'GUEST':
        return 'Guest';
      default:
        return role;
    }
  };

  const getInviteDisplayName = (invite: HomeInviteFragment): string => {
    return invite.recipientName || invite.email.split('@')[0] || invite.email;
  };

  const formatInviteStatus = (status: string): string => {
    switch (status) {
      case 'PENDING':
        return 'Invited';
      case 'ACCEPTED':
        return 'Accepted';
      case 'DECLINED':
        return 'Declined';
      case 'EXPIRED':
        return 'Expired';
      case 'REVOKED':
        return 'Revoked';
      default:
        return status;
    }
  };

  const getInviteStatusColor = (status: string): string => {
    switch (status) {
      case 'PENDING':
        return '#FFA500'; // Orange
      case 'ACCEPTED':
        return '#4CAF50'; // Green
      case 'DECLINED':
        return '#F44336'; // Red
      case 'EXPIRED':
        return '#9E9E9E'; // Gray
      case 'REVOKED':
        return '#9E9E9E'; // Gray
      default:
        return '#9E9E9E';
    }
  };

  return (
    <View style={styles.membersSection}>
      <Text style={styles.membersSectionTitle}>Members</Text>
      <View style={styles.membersList}>
        {members.map(member => {
          const displayName = getMemberDisplayName(member);
          const isCurrentUser = member.user?.id === currentUser?.id;
          
          return (
            <View 
              key={member.id} 
              style={[
                styles.memberChip,
                isCurrentUser && styles.currentUserChip
              ]}
            >
              <Text style={[
                styles.memberChipText,
                isCurrentUser && styles.currentUserText
              ]}>
                {displayName}
              </Text>
              <Text style={styles.memberRole}>
                {formatRole(member.role)}
              </Text>
            </View>
          );
        })}
        
        {pendingInvites.map(invite => {
            const displayName = getInviteDisplayName(invite);
            const statusColor = getInviteStatusColor(invite.status);
            
            return (
              <View 
                key={invite.id} 
                style={[
                  styles.inviteChip,
                  { borderColor: statusColor }
                ]}
              >
                <Text style={[
                  styles.inviteChipText,
                  { color: statusColor }
                ]}>
                  {displayName}
                </Text>
                <Text style={[
                  styles.inviteStatus,
                  { color: statusColor }
                ]}>
                  {formatInviteStatus(invite.status)}
                </Text>
              </View>
            );
          })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  membersSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 12,
  },
  membersSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberChip: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  memberChipText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  currentUserChip: {
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  currentUserText: {
    color: 'white',
    fontWeight: '700',
  },
  inviteChip: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    minWidth: 60,
    alignItems: 'center',
  },
  inviteChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inviteStatus: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
  },
}));
