import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';

interface PantryHeaderProps {
  /** User's display name */
  userName: string;
  /** Current household name */
  householdName: string;
  /** Optional avatar URL */
  avatarUrl?: string | null;
  /** Number of unread notifications */
  notificationCount?: number;
  /** Callback when avatar is pressed */
  onAvatarPress?: () => void;
  /** Callback when household badge is pressed */
  onHomePress?: () => void;
}

/**
 * PantryHeader - Greeting row with user info and avatar
 *
 * Displays:
 * - Personalized greeting with user name
 * - Household badge with name and navigation
 * - Avatar with optional notification badge
 */
export const PantryHeader: React.FC<PantryHeaderProps> = React.memo(
  ({
    userName,
    householdName,
    avatarUrl,
    notificationCount = 0,
    onAvatarPress,
    onHomePress,
  }) => {
    const { theme } = useUnistyles();

    return (
      <View style={styles.greetingRow}>
        <View style={styles.greetingContent}>
          <Text style={styles.greeting}>
            Hello, <Text style={styles.userName}>{userName}</Text>!
          </Text>
          <Pressable onPress={onHomePress} style={styles.householdBadge}>
            <Icon
              size={theme.typography.fontSize.lg}
              name="home-switch-outline"
              library="MaterialDesignIcons"
              color={theme.colors.primary}
            />
            <Text style={styles.householdName}>{householdName}</Text>
            <Icon
              name="chevron-right"
              size={theme.typography.fontSize.lg}
              color={theme.colors.textTertiary}
            />
          </Pressable>
        </View>

        {/* Avatar */}
        <Pressable onPress={onAvatarPress} style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon
                library="Ionicons"
                name="person"
                size={24}
                color={theme.colors.textSecondary}
              />
            </View>
          )}
          {notificationCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationCount}>
                {notificationCount > 9 ? '9+' : notificationCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    );
  },
);

PantryHeader.displayName = 'PantryHeader';

const styles = StyleSheet.create(theme => ({
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  greetingContent: {
    flex: 1,
    justifyContent: 'center',
    alignContent: 'center',
  },
  greeting: {
    fontSize: theme.typography.fontSize['2xl'] + 2,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.secondaryDark,
  },
  userName: {
    color: theme.colors.primary,
  },
  householdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs + 2,
  },
  householdName: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  avatarContainer: {
    position: 'relative',
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
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.xl - 2,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  notificationBadge: {
    position: 'absolute',
    top: -theme.spacing.xs,
    right: -theme.spacing.xs,
    minWidth: theme.spacing['5'],
    height: theme.spacing['5'],
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  notificationCount: {
    fontSize: theme.typography.fontSize.xs - 1,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.white,
  },
}));
