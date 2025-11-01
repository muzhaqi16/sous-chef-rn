import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
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
      paddingLeft: imageUrl ? 8 : 16,
      paddingRight: selected ? 12 : 16,
      borderWidth: 1.5,
      borderColor: selected
        ? theme.colors.primary
        : theme.colors.border || '#c9d3db',
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
        : theme.colors.chipText || '#222',
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

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingLeft: 16,
    paddingVertical: 8,
    margin: 4,
  },
  image: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  iconContainer: {
    marginLeft: 8,
  },
});
