import React from 'react';
import { View } from 'react-native';
import {
  Pressable,
  ThemedBackButton,
  ThemedIconButton,
} from '#components/atoms/themedComponents';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
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

  // Edit badge: fade + shrink away (in first half of progress)
  const badgeStyle = useAnimatedStyle(() => {
    if (!progress) return {};
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
    return { opacity, transform: [{ scale }] };
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
          uniProps={t => ({ color: t.colors.textPrimary })}
        />
        <Pressable
          onPress={onAvatarPress}
          style={({ pressed }) => [
            styles.avatarContainer,
            pressed && styles.pressed,
          ]}
        >
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
                    console.log('Avatar image failed to load:', avatarUrl)
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
        </Pressable>
        <ThemedIconButton
          name="ellipsis-vertical"
          onPress={onMore}
          uniProps={t => ({ color: t.colors.textPrimary })}
          accessibilityLabel="More options"
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
    backgroundColor: theme.colors.primary,
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
