import React from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { IconButton } from '../atoms/IconButton';
import { Icon } from '#/utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';

const SCROLL_DISTANCE = 80;
const AVATAR_LARGE = 80;
const AVATAR_SMALL = 44;
const PADDING_LARGE = 0;
const PADDING_SMALL = 0;

export interface ProfileHeaderProps {
  avatarUrl?: string | null;
  name: string;
  subtitle?: string;
  onBack: () => void;
  onMore: () => void;
  onAvatarPress: () => void;
  scrollY?: SharedValue<number>;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  avatarUrl,
  onBack,
  onMore,
  onAvatarPress,
  scrollY,
}) => {
  const { theme } = useUnistyles();

  const headerAnimatedStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    const paddingVertical = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [PADDING_LARGE, PADDING_SMALL],
      Extrapolation.CLAMP,
    );
    return { paddingVertical };
  });

  const avatarAnimatedStyle = useAnimatedStyle(() => {
    if (!scrollY) return { width: AVATAR_LARGE, height: AVATAR_LARGE, borderRadius: AVATAR_LARGE / 2 };
    const size = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [AVATAR_LARGE, AVATAR_SMALL],
      Extrapolation.CLAMP,
    );
    return { width: size, height: size, borderRadius: size / 2 };
  });

  const editIconAnimatedStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    const opacity = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE / 2],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  return (
    <Animated.View style={[styles.header, headerAnimatedStyle]}>
      <IconButton
        name="arrow-back"
        onPress={onBack}
        color={theme.colors.textPrimary}
        accessibilityLabel="Go back"
      />
      <Pressable onPress={onAvatarPress} style={({pressed}) => [styles.avatarContainer, pressed && styles.pressed]}>
        {avatarUrl ? (
          <Animated.View style={[styles.avatarBase, avatarAnimatedStyle]}>
            <CachedImage
              uri={avatarUrl}
              style={styles.avatarImage}
              onFailure={() =>
                console.log('Avatar image failed to load:', avatarUrl)
              }
            />
          </Animated.View>
        ) : (
          <Animated.View style={[styles.avatarBase, styles.avatarPlaceholder, avatarAnimatedStyle]}>
            <Icon
              name="person"
              size={32}
              color={theme.colors.textSecondary}
            />
          </Animated.View>
        )}
        <Animated.View style={[styles.profileAction, editIconAnimatedStyle]}>
          <Icon
            color={theme.colors.iconOnPrimary}
            name="create"
            size={15}
          />
        </Animated.View>
      </Pressable>
      <IconButton
        name="ellipsis-vertical"
        onPress={onMore}
        color={theme.colors.textPrimary}
        accessibilityLabel="More options"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: 0,
    marginBottom: theme.spacing.sm,
  },
  avatarContainer: {},
  avatarBase: {
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
