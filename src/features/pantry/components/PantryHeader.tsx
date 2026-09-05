import React, { useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { OfflineStatusPill } from '#components/molecules/OfflineStatusPill';
import { Text } from '#components/atoms/Text';

// Matches theme.typography.fontSize.lg (18). Inlined so the component does not
// need useUnistyles — the theme value is module-static.
const ICON_SIZE_LG = 18;

// Width of the accent ring drawn around the avatar. The image inside the ring
// has to subtract this from the ring's corner radius, so the two live together.
const AVATAR_BORDER_WIDTH = 2;

// Splits a translated greeting around the user's name without false matches
// when the name also appears in the surrounding text.
const GREETING_NAME_TOKEN = 'NAME';

interface PantryHeaderProps {
  /** Omitted when the account has no name yet — see `greetingNoName`. */
  userName?: string;
  householdName: string;
  avatarUrl?: string | null;
  notificationCount?: number;
  onAvatarPress?: () => void;
  onHomePress?: () => void;
  onNotificationPress?: () => void;
  /** Screen-coordinate rect, measured after native layout settles. */
  onHomeBadgeLayout?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}

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

  // A whole greeting written for the no-name case, not a filler word
  // interpolated into the named one — "Hello, there!" does not translate.
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
        <View style={styles.greetingTextRow} testID="pantry-greeting-row">
          {!!greetingBefore && (
            <Text role="heading" style={styles.greeting}>
              {greetingBefore}
            </Text>
          )}
          {!!userName && (
            <Text role="title" tone="accent">
              {userName}
            </Text>
          )}
          {/* The trailing punctuation belongs to the name, so it takes the
              name's role rather than the greeting's smaller one. */}
          {!!greetingAfter && (
            <Text role="title" style={styles.greeting}>
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
                // Android native layout has to settle before measuring.
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
            <Text role="caption" tone="secondary">
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
          accessibilityLabel={t('labels.notifications')}
        >
          <Icon name="notifications-outline" size={24} tone="textSecondary" />
          {notificationCount > 0 && <View style={styles.notificationDot} />}
        </Pressable>
      )}

      {/* Avatar */}
      <Pressable
        onPress={onAvatarPress}
        accessibilityLabel={t('a11y.openProfile')}
        style={styles.avatarContainer}
        testID="tab-profile"
        accessibilityRole="button"
      >
        {avatarUrl ? (
          // Border on this wrapper View, not the inner CachedImage: TurboImage's
          // `style` prop isn't ShadowTree-subscribed, so a primary-color border
          // there goes stale on App Color changes.
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
    // Leading must come with the font size: `Text` only pairs the two via its
    // `size` PROP, so a style-set `fontSize` keeps the variant's line box and
    // clips glyphs — visible on diacritics above the cap height.
    color: theme.colors.textPrimary,
  },
  householdBadge: {
    marginTop: theme.spacing.xs,
  },
  householdBadgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xsPlus,
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
    // Primary so the unread dot tracks the user's App Color; a standalone host
    // View, so the ShadowTree pushes the change without a re-render.
    backgroundColor: theme.colors.primary,
    borderWidth: theme.borderWidth.medium,
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
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // RN View, so the ShadowTree updates the border on App Color changes.
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
