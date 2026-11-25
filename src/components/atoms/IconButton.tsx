import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import type { IconLibrary, IconSizeName } from '#components/atoms/Icon';
import { Icon, type IconTone } from '#components/atoms/Icon';
import { HapticService } from '#services/haptic/HapticService';
import { Pressable as GesturePressable } from 'react-native-gesture-handler';
import { Pressable } from '#components/atoms/themedComponents';
import { borderlessRipple } from '#constants/ripple';
import { useInGestureRow } from '#context/GestureRowContext';

const UniIcon = withUnistyles(Icon);

const BORDERLESS_RIPPLE = borderlessRipple(22);

export interface IconButtonProps {
  /** glyph name to render */
  name: string;
  /** tap handler */
  onPress: () => void;
  /** Accessibility label (required for screen readers) */
  accessibilityLabel: string;
  /** Additional context for screen readers */
  accessibilityHint?: string;
  /** Accessibility role (defaults to 'button') */
  accessibilityRole?: 'button' | 'imagebutton';
  /** A step of the icon ramp (default 'md'); the target stays 44pt. */
  size?: IconSizeName;
  /**
   * Named colour role. `tone` is how a caller asks for a theme colour, so a
   * themed icon button needs no `withUnistyles` wrapper of its own.
   */
  tone?: IconTone;
  /** A colour the theme does not name — a brand tint, a photo overlay. */
  color?: string;
  /** extra styling on the Pressable */
  style?: StyleProp<ViewStyle>;
  library?: IconLibrary;
  /** whether button is disabled */
  disabled?: boolean;
  /** A toggle's state, such as a pinned store; left out, the button is no toggle. */
  selected?: boolean;
  /** test ID for testing */
  testID?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  name,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  size = 'md',
  tone,
  color,
  style,
  library,
  disabled = false,
  selected,
  testID,
}) => {
  const inGestureRow = useInGestureRow();
  const handlePress = () => {
    HapticService.selection();
    onPress();
  };

  const pressProps = {
    style: ({ pressed }: { pressed: boolean }) => [
      styles.button,
      pressed && !disabled && styles.pressed,
      style,
    ],
    onPress: handlePress,
    disabled,
    android_ripple: BORDERLESS_RIPPLE,
    accessibilityRole,
    accessibilityLabel,
    accessibilityHint,
    accessibilityState:
      selected === undefined ? { disabled } : { disabled, selected },
    testID,
  };
  const icon = (
    <UniIcon
      library={library}
      name={name}
      size={size}
      tone={disabled ? 'iconDisabled' : tone ?? 'iconPrimary'}
      uniProps={() => (color && !disabled ? { color } : {})}
    />
  );

  // Inside a swipe row, RNGH's: an RN Pressable there takes the touch, and a
  // swipe that starts on the button never moves the row.
  return inGestureRow ? (
    <GesturePressable {...pressProps}>{icon}</GesturePressable>
  ) : (
    <Pressable {...pressProps}>{icon}</Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  button: {
    minWidth: theme.sizes.touchTarget.min,
    minHeight: theme.sizes.touchTarget.min,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
