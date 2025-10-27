import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useGetHomeInvitesQuery } from '#generated';
import { Icon } from '#utils';
import { formatRole, getRoleBadgeStyle } from '#utils/formatters';
import { HomeActions } from './HomeActions';
import { MembersList } from './MembersList';
import { commonStyles } from '#/styles';

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
  pantries?: Array<{ id: string }>;
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
  onPress?: (homeId: string) => void;
  onSetDefault: (homeId: string) => void;
  onInvite: (homeId: string) => void;
  onDelete: (homeId: string, homeName: string) => void;
}

export const HomeCard: React.FC<HomeCardProps> = ({
  home,
  isDefault,
  onPress,
  onSetDefault,
  onInvite,
  onDelete,
}) => {
  const { theme } = useUnistyles();

  // Fetch invites for this specific home
  const { data: invitesData } = useGetHomeInvitesQuery({
    variables: { homeId: home.id },
    fetchPolicy: 'cache-and-network',
  });

  const homeInvites = invitesData?.homeInvites || [];

  const handleDelete = () => {
    onDelete(home.id, home.name);
  };

  return (
    <View style={styles.homeCard}>
      <TouchableOpacity
        style={styles.homeHeader}
        onPress={() => onPress?.(home.id)}
        activeOpacity={onPress ? 0.7 : 1}
      >
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
                getRoleBadgeStyle(home.myMembership.role, theme),
              ]}
            >
              <Text
                style={[
                  styles.roleText,
                  { color: getRoleBadgeStyle(home.myMembership.role, theme).color },
                ]}
              >
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
        {onPress && (
          <Icon name="chevron-forward" size={20} color="#999" library="Ionicons" />
        )}
      </TouchableOpacity>

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
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    ...commonStyles.shadow,
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
