import React from 'react';
import {View, Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {HomeActions} from './HomeActions';
import {MembersList} from './MembersList';

export type PartialHome = {
  id: string;
  name: string;
  members?: Array<{
    id: string;
    user?: {
      email?: string;
      profile?: {
        firstName?: string;
      };
    };
  }>;
  pantries?: Array<{id: string}>;
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
  const handleDelete = () => {
    onDelete(home.id, home.name);
  };

  return (
    <View style={styles.homeCard}>
      <View style={styles.homeHeader}>
        <View style={styles.homeInfo}>
          <Text style={styles.homeName}>{home.name}</Text>
          <Text style={styles.homeDetails}>
            {home.members?.length || 0} members • {home.pantries?.length || 0}{' '}
            pantries
          </Text>
        </View>
        {isDefault && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultText}>Default</Text>
          </View>
        )}
      </View>

      <HomeActions
        homeId={home.id}
        isDefault={isDefault}
        onSetDefault={onSetDefault}
        onInvite={onInvite}
        onDelete={handleDelete}
      />

      <MembersList members={home.members || []} />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  homeCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
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
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  homeDetails: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  defaultBadge: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  defaultText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
}));
