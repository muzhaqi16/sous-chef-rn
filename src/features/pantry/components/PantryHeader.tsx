import React, { useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { OfflineStatusPill } from '#components/atoms/OfflineStatusPill';
import { Text } from '#components/atoms/Text';

// Matches theme.typography.fontSize.lg (18). Inlined so the component does not
// need useUnistyles — the theme value is module-static.
const ICON_SIZE_LG = 18;

// Width of the accent ring drawn around the avatar. The image inside the ring
// has to subtract this from the ring's corner radius, so the two live together.
const AVATAR_BORDER_WIDTH = 2;

// Sentinel used to split a translated greeting around the user's name without
// false matches if the name itself appears in the surrounding text.
const GREETING_NAME_TOKEN = 'NAME';

interface PantryHeaderProps {
  /** User's display name */
  /** Omitted when the account has no name yet — see `greetingNoName`. */
  userName?: string;
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
  const { t } = useTranslation();
  const badgeRef = useRef<View>(null);

  // With no name to show, use a whole greeting written for that case rather
  // than interpolating a filler word into the named one — "Hello, there!"
  // does not translate ("¡Hola, hola!").
  const greetingTemplate = userName
    ? t('pantryHeader.greeting', { name: GREETING_NAME_TOKEN })
    : t('pantryHeader.greetingNoName');
  const [greetingBefore, greetingAfter] =
    greetingTemplate.split(GREETING_NAME_TOKEN);

  return (
    <View style={styles.greetingRow}>
      <View style={styles.greetingContent}>
        {/* Greeting pieces render as separate, non-nested <Text> nodes. A
            <Text> nested inside another <Text> becomes a virtual text node
            that Unistyles' C++ ShadowTree color updates don't reach, so an
            accent-colored name span goes stale on App Color changes until a
            remount. Standalone host <Text> nodes update via the ShadowTree
            without any re-render. */}
        <View style={styles.greetingTextRow}>
          {!!greetingBefore && (
            <Text weight="bold" style={styles.greeting}>
              {greetingBefore}
            </Text>
          )}
          {!!userName && (
            <Text weight="bold" size="2xl" tone="accent">
              {userName}
            </Text>
          )}
          {!!greetingAfter && (
            <Text weight="bold" style={styles.greeting}>
              {greetingAfter}
            </Text>
          )}
        </View>
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

      {/* Offline indicator — sits next to the notification bell */}
      <OfflineStatusPill style={styles.offlinePill} />

      {/* Notification bell */}
      {!!onNotificationPress && (
        <Pressable
          onPress={onNotificationPress}
          style={styles.notificationButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('pantryHeader.notificationsLabel')}
        >
          <Icon name="notifications-outline" size={24} tone="textSecondary" />
          {notificationCount > 0 && <View style={styles.notificationDot} />}
        </Pressable>
      )}

      {/* Avatar */}
      <Pressable
        onPress={onAvatarPress}
        style={styles.avatarContainer}
        testID="tab-profile"
        accessibilityRole="button"
      >
        {avatarUrl ? (
          // Border lives on this wrapper View (auto-patched by the Unistyles
          // babel plugin) instead of on the inner CachedImage — TurboImage is
          // a third-party native component whose `style` prop isn't subscribed
          // to ShadowTree updates, so a primary-color border there goes stale
          // on App Color changes.
          <View style={styles.avatarBorder}>
            <CachedImage
              uri={avatarUrl}
              style={styles.avatarImageInner}
              displaySize={48}
            />
          </View>
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
  greetingTextRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
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
  offlinePill: {
    marginRight: theme.spacing.sm,
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
    // Accent (primary) so the unread dot tracks the user's App Color instead of
    // always being red. It's a standalone host View, so the ShadowTree pushes
    // the color update on theme/App-Color change without a re-render.
    backgroundColor: theme.colors.primary,
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
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // RN View — auto-bound to the ShadowTree so the primary-color border
  // updates instantly on App Color changes.
  avatarBorder: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.xl - 2,
    borderCurve: 'continuous',
    borderWidth: AVATAR_BORDER_WIDTH,
    borderColor: theme.colors.primary,
    overflow: 'hidden',
  },
  // The image sits inside the border, so its corners follow the border's INNER
  // curve — radius minus border width. Reusing the outer radius here cuts the
  // corners 2pt too deep and leaves a gap in each corner of the ring, and the
  // parent's `overflow: hidden` can't fill it back in: clipping only removes.
  avatarImageInner: {
    width: '100%',
    height: '100%',
    borderRadius: theme.radii.xl - 2 - AVATAR_BORDER_WIDTH,
    borderCurve: 'continuous',
  },
}));
