import React from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '#/utils/environment';
import { View } from 'react-native';
import {
  ThemedBackButton,
  ThemedIconButton,
} from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useAnimatedTheme } from 'react-native-unistyles/reanimated';
import { Icon } from '#/utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';

const AVATAR_SIZE = 80;
const AVATAR_SCALE_MIN = 0.55; // 80 * 0.55 = 44
const USER_INFO_HEIGHT = 72;

export interface ProfileHeaderProps {
  avatarUrl?: string | null;
  name: string;
  subtitle?: string;
  onBack: () => void;
  onMore: () => void;
  onAvatarPress: () => void;
  /** Collapse progress: 0 = expanded, 1 = collapsed. Animated via withTiming. */
  progress?: SharedValue<number>;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  avatarUrl,
  name,
  subtitle,
  onBack,
  onMore,
  onAvatarPress,
  progress,
}) => {
  const { t } = useTranslation();
  const animatedTheme = useAnimatedTheme();

  // Avatar: scale from 1 → 0.55 (GPU composited, no layout recalc)
  const avatarScaleStyle = useAnimatedStyle(() => {
    if (!progress) return {};
    const scale = interpolate(
      progress.get(),
      [0, 1],
      [1, AVATAR_SCALE_MIN],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }] };
  });

  // Edit badge: fade + shrink away (in first half of progress).
  // The brand color is read inside the worklet so Reanimated is the sole writer
  // of the badge node; if it lived on the static stylesheet, a Reanimated commit
  // could land over a freshly-applied theme color and pin the badge to the
  // previous brand color until remount. Returned in both branches so the color
  // is present even when there is no collapse progress to animate.
  const badgeStyle = useAnimatedStyle(() => {
    const backgroundColor = animatedTheme.get().colors.primary;
    if (!progress) return { backgroundColor };
    const opacity = interpolate(
      progress.get(),
      [0, 0.5],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      progress.get(),
      [0, 0.5],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { backgroundColor, opacity, transform: [{ scale }] };
  });

  // User info: collapse height + scaleY + opacity in a single worklet so the
  // ScrollView reclaims layout space as the content fades.
  const userInfoStyle = useAnimatedStyle(() => {
    if (!progress) return {};
    const scaleY = interpolate(
      progress.get(),
      [0, 1],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      progress.get(),
      [0, 0.5],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const height = interpolate(
      progress.get(),
      [0, 1],
      [USER_INFO_HEIGHT, 0],
      Extrapolation.CLAMP,
    );
    return {
      height,
      opacity,
      transform: [{ scaleY }],
    };
  });

  return (
    <View>
      <View style={styles.header}>
        <ThemedBackButton
          onPress={onBack}
          uniProps={theme => ({ color: theme.colors.textPrimary })}
        />
        <AppPressable onPress={onAvatarPress} style={styles.avatarContainer}>
          <Animated.View
            collapsable={false}
            style={[styles.avatarScaleWrapper, avatarScaleStyle]}
          >
            {avatarUrl ? (
              <View style={styles.avatarBase}>
                <CachedImage
                  uri={avatarUrl}
                  style={styles.avatarImage}
                  displaySize={AVATAR_SIZE}
                  onFailure={() =>
                    logger.warn('Avatar image failed to load:', avatarUrl)
                  }
                />
              </View>
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Icon name="person" size={32} tone="textSecondary" />
              </View>
            )}
          </Animated.View>
          <Animated.View
            collapsable={false}
            style={[styles.profileAction, badgeStyle]}
          >
            <Icon tone="iconOnPrimary" name="create" size={15} />
          </Animated.View>
        </AppPressable>
        <ThemedIconButton
          name="ellipsis-vertical"
          onPress={onMore}
          uniProps={theme => ({ color: theme.colors.textPrimary })}
          accessibilityLabel={t('labels.moreOptions')}
        />
      </View>
      {(!!name || !!subtitle) && (
        <Animated.View
          collapsable={false}
          style={[styles.userInfo, userInfoStyle]}
        >
          {!!name && (
            <Text size="lg" weight="bold" style={styles.nameText}>
              {name}
            </Text>
          )}
          {!!subtitle && (
            <Text size="sm" tone="secondary" style={styles.subtitleText}>
              {subtitle}
            </Text>
          )}
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  avatarContainer: {},
  avatarScaleWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarBase: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAction: {
    position: 'absolute',
    right: -4,
    bottom: -10,
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: theme.radii.full,
    // backgroundColor is driven by the worklet in `badgeStyle` — see the note
    // there; the brand color must not live on the static stylesheet of a node
    // Reanimated also commits to.
  },
  userInfo: {
    alignItems: 'center',
    overflow: 'hidden',
    transformOrigin: 'top',
  },
  nameText: {
    marginTop: theme.spacing.sm,
  },
  subtitleText: {
    marginTop: 2,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
