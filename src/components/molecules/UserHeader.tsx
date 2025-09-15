import React from 'react';
import {View, Text, TouchableOpacity, Image} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useProfileData, useAppNavigation} from '#/hooks';
import {Icon} from '#utils';

export const UserHeader: React.FC = () => {
  const {navigateTo} = useAppNavigation();
  const {profile} = useProfileData();
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>
        Hello{' '}
        <Text style={{fontWeight: 'bold'}}>
          {profile?.displayName
            ? profile.displayName.split(' ')[0]
            : profile?.firstName || 'User'}
        </Text>
      </Text>

      <View style={styles.headerActions}>
        <TouchableOpacity
          onPress={() => {
            navigateTo.notificationList();
          }}>
          <View style={styles.avatar}>
            {profile?.avatar ? (
              <Image
                alt=""
                source={{uri: profile.avatar}}
                style={styles.avatarImg}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Icon
                  library="Ionicons"
                  name="person"
                  size={24}
                  color={styles.avatarIcon.color}
                />
              </View>
            )}

            <View style={styles.avatarNotification} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  /** Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: theme.spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '400',
    color: '#222',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  headerNotifications: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Avatar */
  avatar: {
    position: 'relative',
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 9999,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    color: theme.colors.textSecondary,
  },
  avatarNotification: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: '#fff',
    top: 0,
    right: -2,
    width: 14,
    height: 14,
    backgroundColor: '#f77171',
  },
}));
