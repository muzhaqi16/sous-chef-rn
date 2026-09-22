import React from 'react';
import { View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useAnimatedTheme } from 'react-native-unistyles/reanimated';
import { useTranslation } from '#/i18n';
import { logger } from '#/utils/environment';
import { Icon } from '#/utils/iconUtils';
import { AppPressable } from '#components/atoms/AppPressable';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';

const AVATAR_SIZE = 80;
const AVATAR_SCALE_MIN = 0.55;

export interface ProfileHeroProps {
  avatarUrl?: string | null;
  name: string;
  subtitle?: string;
  onAvatarPress: () => void;
  /** The scroll offset of the content the hero leads. */
  scrollY: SharedValue<number>;
}

/**
 * The identity block at the top of Profile's scroll content. It shrinks and
 * fades by transform and opacity only: its height stays fixed, so the offset
 * under the finger never moves while it collapses.
 */
export const ProfileHero: React.FC<ProfileHeroProps> = ({
  avatarUrl,
  name,
  subtitle,
  onAvatarPress,
  scrollY,
}) => {
  const { t } = useTranslation();
  const animatedTheme = useAnimatedTheme();

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          scrollY.get(),
          [0, AVATAR_SIZE],
          [1, AVATAR_SCALE_MIN],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // The brand colour is read inside the worklet so Reanimated is the badge's
  // only writer; on the static sheet a Reanimated commit could pin it to the
  // previous brand colour until remount.
  const badgeStyle = useAnimatedStyle(() => ({
    backgroundColor: animatedTheme.get().colors.primary,
    opacity: interpolate(
      scrollY.get(),
      [0, AVATAR_SIZE / 2],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const infoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.get(),
      [0, AVATAR_SIZE / 2],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={styles.hero}>
      <AppPressable
        onPress={onAvatarPress}
        accessibilityLabel={t('a11y.changePhoto')}
      >
        <Animated.View collapsable={false} style={[styles.avatar, avatarStyle]}>
          {avatarUrl ? (
            <CachedImage
              uri={avatarUrl}
              style={styles.avatarImage}
              displaySize={AVATAR_SIZE}
              onError={() =>
                logger.warn('Avatar image failed to load:', avatarUrl)
              }
            />
          ) : (
            <Icon name="person" size={32} tone="textSecondary" />
          )}
        </Animated.View>
        <Animated.View collapsable={false} style={[styles.badge, badgeStyle]}>
          <Icon tone="iconOnPrimary" name="create" size={15} />
        </Animated.View>
      </AppPressable>
      {(!!name || !!subtitle) && (
        <Animated.View collapsable={false} style={[styles.info, infoStyle]}>
          {!!name && (
            <Text role="heading" align="center">
              {name}
            </Text>
          )}
          {!!subtitle && (
            <Text role="caption" tone="secondary" align="center">
              {subtitle}
            </Text>
          )}
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  hero: {
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: theme.borderWidth.medium,
    borderColor: theme.colors.primary,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    right: -theme.spacing.xs,
    bottom: -theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.sizes.icon.lg - theme.spacing.xs,
    height: theme.sizes.icon.lg - theme.spacing.xs,
    borderRadius: theme.radii.full,
  },
  info: {
    alignItems: 'center',
    gap: theme.spacing['2xs'],
    marginTop: theme.spacing.md,
  },
}));
