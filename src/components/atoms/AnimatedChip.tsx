import React from 'react';
import { Image } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Icon } from '#utils';

type AnimatedChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  imageUrl?: string;
};

export const AnimatedChip: React.FC<AnimatedChipProps> = ({
  label,
  selected,
  onPress,
  disabled = false,
  imageUrl,
}) => {
  const { theme } = useUnistyles();

  // Animated container style with dynamic padding and colors
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      paddingLeft: imageUrl ? theme.spacing.sm : theme.spacing.md,
      paddingRight: selected ? theme.spacing['3'] : theme.spacing.md,
      borderWidth: 1.5,
      borderColor: selected
        ? theme.colors.primary
        : theme.colors.border,
      backgroundColor: selected
        ? theme.colors.chipSelectedBackground
        : theme.colors.chipBackground,
      opacity: disabled ? 0.5 : 1,
    };
  }, [selected, disabled, theme, imageUrl]);

  // Animated text style for color transitions
  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      color: selected
        ? theme.colors.chipSelectedText
        : theme.colors.chipText,
    };
  }, [selected, theme]);

  return (
    <Animated.View
      layout={LinearTransition.springify().mass(0.8).damping(20).stiffness(200)}
      onTouchEnd={disabled ? undefined : onPress}
      style={[styles.container, animatedContainerStyle]}
    >
      {imageUrl && (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      )}
      <Animated.Text style={[styles.label, animatedTextStyle]}>
        {label}
      </Animated.Text>
      {selected && (
        <Animated.View
          style={styles.iconContainer}
          layout={LinearTransition}
          entering={FadeIn.duration(200).easing(
            Easing.bezier(0.25, 0.1, 0.25, 1).factory(),
          )}
          exiting={FadeOut.duration(150).easing(
            Easing.bezier(0.25, 0.1, 0.25, 1).factory(),
          )}
        >
          <Icon
            name="check-circle"
            size={18}
            color={theme.colors.chipSelectedText}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    alignItems: 'center',
    borderRadius: theme.radii['2xl'],
    flexDirection: 'row',
    justifyContent: 'center',
    paddingLeft: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    margin: theme.spacing.xs,
  },
  image: {
    width: theme.sizes.icon.md,
    height: theme.sizes.icon.md,
    borderRadius: theme.radii.lg,
    marginRight: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.fontSize.sm + 1,
    fontWeight: '600',
  },
  iconContainer: {
    marginLeft: theme.spacing.sm,
  },
}));
