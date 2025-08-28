import React from 'react';
import {View, Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

interface Member {
  id: string;
  user?: {
    email?: string;
    profile?: {
      firstName?: string;
    };
  };
}

interface MembersListProps {
  members: Member[];
}

export const MembersList: React.FC<MembersListProps> = ({members}) => {
  if (!members || members.length === 0) return null;

  return (
    <View style={styles.membersSection}>
      <Text style={styles.membersSectionTitle}>Members</Text>
      <View style={styles.membersList}>
        {members.map(member => (
          <View key={member.id} style={styles.memberChip}>
            <Text style={styles.memberChipText}>
              {member?.user?.profile?.firstName || member?.user?.email}
            </Text>
          </View>
        ))}
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
    paddingVertical: 6,
    borderRadius: 16,
  },
  memberChipText: {
    fontSize: 14,
    color: theme.colors.primary,
  },
}));
