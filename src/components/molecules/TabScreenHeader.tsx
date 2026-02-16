import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';

interface TabScreenHeaderProps {
  label: string;
  title: string;
  avatarUrl?: string | null;
  notificationCount?: number;
  onAvatarPress?: () => void;
}

export const TabScreenHeader: React.FC<TabScreenHeaderProps> = ({
  label,
  title,
  avatarUrl,
  notificationCount = 0,
  onAvatarPress,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.leftContent}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
      </View>

      <View style={styles.headerActions}>
        <Pressable onPress={onAvatarPress} style={styles.avatarPressable}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <CachedImage
                uri={avatarUrl}
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

            {notificationCount > 0 && (
              <View style={styles.avatarNotification} />
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  leftContent: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  label: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.regular,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontSize: theme.fonts.size['2xl'],
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  avatarPressable: {
    borderRadius: theme.radii.xl,
  },
  avatar: {
    position: 'relative',
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.xl - 2,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.xl - 2,
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
}));
