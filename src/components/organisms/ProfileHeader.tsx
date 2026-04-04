import React from 'react';
import { Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { IconButton } from '../atoms/IconButton';
import { BackButton } from '../atoms/BackButton';
import { Icon } from '#/utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';

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
  const { theme } = useUnistyles();

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

  // User info: collapse height + fade
  const userInfoStyle = useAnimatedStyle(() => {
    if (!progress) return {};
    const height = interpolate(
      progress.get(),
      [0, 1],
      [USER_INFO_HEIGHT, 0],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      progress.get(),
      [0, 0.5],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { height, opacity };
  });

  return (
    <View>
      <View style={styles.header}>
        <BackButton onPress={onBack} color={theme.colors.textPrimary} />
        <Pressable
          onPress={onAvatarPress}
          style={({ pressed }) => [
            styles.avatarContainer,
            pressed && { opacity: theme.opacity.pressed },
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
                <Icon
                  name="person"
                  size={32}
                  color={theme.colors.textSecondary}
                />
              </View>
            )}
          </Animated.View>
          <Animated.View
            collapsable={false}
            style={[styles.profileAction, badgeStyle]}
          >
            <Icon color={theme.colors.iconOnPrimary} name="create" size={15} />
          </Animated.View>
        </Pressable>
        <IconButton
          name="ellipsis-vertical"
          onPress={onMore}
          color={theme.colors.textPrimary}
          accessibilityLabel="More options"
        />
      </View>
      {(!!name || !!subtitle) && (
        <Animated.View
          collapsable={false}
          style={[styles.userInfo, userInfoStyle]}
        >
          {!!name && <Text style={styles.nameText}>{name}</Text>}
          {!!subtitle && <Text style={styles.subtitleText}>{subtitle}</Text>}
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
  },
  nameText: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    marginTop: 8,
  },
  subtitleText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
}));
