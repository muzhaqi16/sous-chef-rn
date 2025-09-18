import React from 'react';
import {View, Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useGetHomeInvitesQuery} from '#generated';
import {HomeActions} from './HomeActions';
import {MembersList} from './MembersList';

export type PartialHome = {
  id: string;
  name: string;
  members?: Array<{
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
  }>;
  pantries?: Array<{id: string}>;
  myMembership?: {
    id: string;
    role: string;
    status: string;
    displayName?: string;
  } | null;
};

interface HomeCardProps {
  home: PartialHome;
  isDefault: boolean;
  onSetDefault: (homeId: string) => void;
  onInvite: (homeId: string) => void;
  onDelete: (homeId: string, homeName: string) => void;
}

export const HomeCard: React.FC<HomeCardProps> = ({
  home,
  isDefault,
  onSetDefault,
  onInvite,
  onDelete,
}) => {
  // Fetch invites for this specific home
  const {data: invitesData, loading: invitesLoading} = useGetHomeInvitesQuery({
    variables: {homeId: home.id},
    fetchPolicy: 'cache-and-network',
  });

  const homeInvites = invitesData?.homeInvites || [];

  const handleDelete = () => {
    onDelete(home.id, home.name);
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

  const getRoleBadgeColor = (role: string): string => {
    switch (role) {
      case 'OWNER':
        return '#FF6B35'; // Orange for owner
      case 'ADMIN':
        return '#4CAF50'; // Green for admin
      case 'MEMBER':
        return '#2196F3'; // Blue for member
      case 'GUEST':
        return '#9E9E9E'; // Gray for guest
      default:
        return '#9E9E9E';
    }
  };
  return (
    <View style={styles.homeCard}>
      <View style={styles.homeHeader}>
        <View style={styles.homeInfo}>
          <Text style={styles.homeName}>{home.name}</Text>
          <Text style={styles.homeDetails}>
            {home.members?.length || 0} members
            {'  '}
            {home.pantries?.length || 0} pantries
          </Text>
        </View>
        <View style={styles.badgeContainer}>
          {home.myMembership?.role && (
            <View
              style={[
                styles.roleBadge,
                {
                  backgroundColor:
                    getRoleBadgeColor(home.myMembership.role) + '20',
                },
              ]}>
              <Text
                style={[
                  styles.roleText,
                  {color: getRoleBadgeColor(home.myMembership.role)},
                ]}>
                {formatRole(home.myMembership.role)}
              </Text>
            </View>
          )}
          {isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultText}>Default</Text>
            </View>
          )}
        </View>
      </View>

      <HomeActions
        homeId={home.id}
        isDefault={isDefault}
        onSetDefault={onSetDefault}
        onInvite={onInvite}
        onDelete={handleDelete}
      />

      <MembersList members={home.members || []} invites={homeInvites || []} />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  homeCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: 12,
    shadowColor: theme.colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  homeInfo: {
    flex: 1,
  },
  homeName: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  homeDetails: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
  },
  roleText: {
    fontSize: 11,
    fontWeight: theme.fonts.weight.semibold,
  },
  defaultBadge: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
  },
  defaultText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
}));
