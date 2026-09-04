import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { IconLibrary, Icon, type IconTone } from '#/utils/iconUtils';
import { HapticService } from '#services/haptic/HapticService';
import { Pressable } from '#components/atoms/themedComponents';
import { borderlessRipple } from '#constants/ripple';

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
  /** icon size variant (default 'md') */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
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
  testID,
}) => {
  const handlePress = () => {
    HapticService.selection();
    onPress();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled}
      android_ripple={BORDERLESS_RIPPLE}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <UniIcon
        library={library}
        name={name}
        tone={disabled ? 'iconDisabled' : tone ?? 'iconPrimary'}
        uniProps={theme => ({
          size: theme.sizes.icon[size],
          ...(color && !disabled ? { color } : {}),
        })}
      />
    </Pressable>
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

export default IconButton;
