import React, { useRef } from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';

// Matches theme.typography.fontSize.lg (18). Inlined so the component does not
// need useUnistyles — the theme value is module-static.
const ICON_SIZE_LG = 18;

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
  /** Callback when notification bell is pressed */
  onNotificationPress?: () => void;
  /** Callback with screen-coordinate rect when the home badge lays out */
  onHomeBadgeLayout?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}

/**
 * PantryHeader - Greeting row with user info and avatar
 *
 * Displays:
 * - Personalized greeting with user name
 * - Household badge with name and navigation
 * - Avatar with optional notification badge
 */
export const PantryHeader: React.FC<PantryHeaderProps> = ({
  userName,
  householdName,
  avatarUrl,
  notificationCount = 0,
  onAvatarPress,
  onHomePress,
  onNotificationPress,
  onHomeBadgeLayout,
}) => {
  const badgeRef = useRef<View>(null);

  return (
    <View style={styles.greetingRow}>
      <View style={styles.greetingContent}>
        <Text weight="bold" style={styles.greeting}>
          Hello,{' '}
          <Text weight="bold" tone="accent" size="2xl">
            {userName}
          </Text>
          !
        </Text>
        <Pressable onPress={onHomePress} style={styles.householdBadge}>
          <View
            ref={badgeRef}
            collapsable={false}
            style={styles.householdBadgeInner}
            onLayout={() => {
              if (onHomeBadgeLayout) {
                // Delay measurement to ensure Android native layout is settled
                requestAnimationFrame(() => {
                  badgeRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
                    if (w > 0 && h > 0) {
                      onHomeBadgeLayout({
                        x: pageX,
                        y: pageY,
                        width: w,
                        height: h,
                      });
                    }
                  });
                });
              }
            }}
          >
            <Icon
              size={ICON_SIZE_LG}
              name="swap-horizontal-outline"
              tone="primary"
            />
            <Text size="sm" tone="secondary">
              {householdName}
            </Text>
            <Icon
              name="chevron-forward"
              size={ICON_SIZE_LG}
              tone="textTertiary"
            />
          </View>
        </Pressable>
      </View>

      {/* Notification bell */}
      {!!onNotificationPress && (
        <Pressable
          onPress={onNotificationPress}
          style={styles.notificationButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Icon name="notifications-outline" size={24} tone="textSecondary" />
          {notificationCount > 0 && <View style={styles.notificationDot} />}
        </Pressable>
      )}

      {/* Avatar */}
      <Pressable onPress={onAvatarPress} style={styles.avatarContainer}>
        {avatarUrl ? (
          <CachedImage
            uri={avatarUrl}
            style={styles.avatarImage}
            displaySize={48}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Icon name="person" size={24} tone="textSecondary" />
          </View>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  greetingContent: {
    flex: 1,
    justifyContent: 'center',
    alignContent: 'center',
  },
  greeting: {
    fontSize: theme.typography.fontSize['2xl'] + 2,
    color: theme.colors.textPrimary,
  },
  householdBadge: {
    marginTop: theme.spacing.xs,
  },
  householdBadgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xs + 2,
  },
  notificationButton: {
    position: 'relative',
    padding: theme.spacing.xs,
    marginRight: theme.spacing.sm,
  },
  notificationDot: {
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
}));
