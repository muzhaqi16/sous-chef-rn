import React from 'react';
import {View, Text, Pressable} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {CachedImage} from '#components/atoms/CachedImage';
import {useProfileData} from '#hooks/profile/useProfileData';
import {useAppNavigation} from '#hooks/navigation/useAppNavigation';
import {Icon} from '#utils/iconUtils';
import {useAppStore} from '#store/useAppStore';

export const UserHeader: React.FC = () => {
  const {navigateTo} = useAppNavigation();
  const {profile} = useProfileData();
  const unreadCount = useAppStore(state => state.unreadCount);

  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>
        Hello, <Text style={styles.headerTitleBold}>
          {profile?.displayName
            ? profile.displayName.split(' ')[0]
            : profile?.firstName || 'User'}
        </Text>
        !
      </Text>

      <View style={styles.headerActions}>
        <Pressable
          onPress={() => {
            navigateTo.notificationList();
          }}
          style={({pressed}) => pressed && styles.pressed}>
          <View style={styles.avatar}>
            {profile?.avatar ? (
              <CachedImage
                uri={profile.avatar}
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

            {unreadCount > 0 && <View style={styles.avatarNotification} />}
          </View>
        </Pressable>
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
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.fonts.size['2xl'],
    fontWeight: theme.fonts.weight.regular,
    color: theme.colors.textOnSurfaceVariant,
  },
  headerTitleBold: {
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  headerNotifications: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginRight: theme.spacing['3'],
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
    borderRadius: theme.radii.full,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.full,
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
    borderRadius: theme.radii.full,
    borderWidth: 2,
    borderColor: theme.colors.white,
    top: 0,
    right: -2,
    width: 14,
    height: 14,
    backgroundColor: theme.colors.error,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
