import React from 'react';
import {TouchableOpacity, StyleProp, ViewStyle} from 'react-native';
import {StyleSheet, withUnistyles} from 'react-native-unistyles';
import {IconLibrary, Icon} from '#/utils/iconUtils';

const UniIcon = withUnistyles(Icon);

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
  /** extra styling on the Touchable */
  style?: StyleProp<ViewStyle>;
  /** override default library—pass Ionicons, MaterialIcons, etc. */
  library?: IconLibrary;
  /** whether button is disabled */
  disabled?: boolean;
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
  library = 'MaterialIcons',
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{disabled}}>
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
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  button: {
    minWidth: theme.sizes.touchTarget.min,
    minHeight: theme.sizes.touchTarget.min,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));

export default IconButton;
