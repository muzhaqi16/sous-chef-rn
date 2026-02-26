import React, { useCallback } from 'react';
import {Pressable, StyleProp, ViewStyle} from 'react-native';
import {StyleSheet, withUnistyles} from 'react-native-unistyles';
import {IconLibrary, Icon} from '#/utils/iconUtils';
import {HapticService} from '#services/haptic/HapticService';

const UniIcon = withUnistyles(Icon);

const BORDERLESS_RIPPLE = { borderless: true, radius: 22 };

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
  /** icon color (defaults to theme.colors.iconPrimary) */
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
  color,
  style,
  library,
  disabled = false,
  testID,
}) => {
  const handlePress = useCallback(() => {
    HapticService.selection();
    onPress();
  }, [onPress]);

  return (
    <Pressable
      style={({pressed}) => [
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
      accessibilityState={{disabled}}
      testID={testID}>
      <UniIcon
        library={library}
        name={name}
        uniProps={theme => ({
          size: theme.sizes.icon[size],
          color: disabled
            ? theme.colors.iconDisabled
            : color ?? theme.colors.iconPrimary,
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
