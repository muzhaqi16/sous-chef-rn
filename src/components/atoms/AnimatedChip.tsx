import React from 'react';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Icon } from '#utils/iconUtils';

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

  // Animated container style — only dynamic properties that change with selection/state
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      paddingLeft: imageUrl ? theme.spacing.sm : theme.spacing.md,
      paddingRight: selected ? theme.spacing['3'] : theme.spacing.md,
      borderColor: selected
        ? theme.colors.primary
        : theme.colors.border,
      backgroundColor: selected
        ? theme.colors.chipSelectedBackground
        : theme.colors.chipBackground,
      opacity: disabled ? theme.opacity.disabled : 1,
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

  // UNISTYLES FIX: Wrapper pattern - static Unistyles on outer View
  return (
    <View style={styles.container}>
      <Animated.View
        layout={LinearTransition.springify().mass(0.8).damping(20).stiffness(200)}
        onTouchEnd={disabled ? undefined : onPress}
        style={[styles.chip, animatedContainerStyle]}
      >
        {imageUrl && (
          <CachedImage
            uri={imageUrl}
            style={styles.image}
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
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    margin: theme.spacing.xs,
  },
  chip: {
    alignItems: 'center',
    borderRadius: theme.radii['2xl'],
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderWidth: 1.5,
  },
  image: {
    width: theme.sizes.icon.md,
    height: theme.sizes.icon.md,
    borderRadius: theme.radii.lg,
    marginRight: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.fontSize.sm + 1,
    fontWeight: theme.fonts.weight.semibold,
  },
  iconContainer: {
    marginLeft: theme.spacing.sm,
  },
}));
