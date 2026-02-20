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
  onNotificationPress?: () => void;
}

export const TabScreenHeader: React.FC<TabScreenHeaderProps> = ({
  label,
  title,
  avatarUrl,
  notificationCount = 0,
  onAvatarPress,
  onNotificationPress,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.leftContent}>
        <Text maxFontSizeMultiplier={1.5} style={styles.label}>{label}</Text>
        <Text maxFontSizeMultiplier={1.5} style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
      </View>

      <View style={styles.headerActions}>
        {/* Notification bell icon */}
        <Pressable
          onPress={onNotificationPress}
          style={styles.notificationButton}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          accessibilityHint="Open notifications"
        >
          <Icon
            name="notifications-outline"
            size={24}
            color={styles.notificationIcon.color}
          />
          {notificationCount > 0 && (
            <View style={styles.notificationBadge} />
          )}
        </Pressable>

        {/* Avatar - navigates to Profile */}
        <Pressable
          onPress={onAvatarPress}
          style={styles.avatarPressable}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          accessibilityHint="Open your profile"
        >
          <View style={styles.avatar}>
            {avatarUrl ? (
              <CachedImage
                uri={avatarUrl}
                style={styles.avatarImg}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Icon
                  name="person"
                  size={24}
                  color={styles.avatarIcon.color}
                />
              </View>
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
    gap: theme.spacing.sm,
  },
  notificationButton: {
    position: 'relative',
    padding: theme.spacing.xs,
  },
  notificationIcon: {
    color: theme.colors.textSecondary,
  },
  notificationBadge: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    width: 10,
    height: 10,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.error,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  avatarPressable: {
    borderRadius: theme.radii.xl,
  },
  avatar: {
    position: 'relative',
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.xl - 2,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
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
}));
