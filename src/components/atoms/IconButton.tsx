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
  /** icon size (default 24) */
  size?: number;
  /** icon color (defaults to theme.colors.iconPrimary) */
  color?: string;
  /** extra styling on the Touchable */
  style?: StyleProp<ViewStyle>;
  /** override default library—pass Ionicons, MaterialIcons, etc. */
  library?: IconLibrary;
}

export const IconButton: React.FC<IconButtonProps> = ({
  name,
  onPress,
  size = 24,
  color,
  style,
  library = 'MaterialIcons',
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
      <UniIcon
        library={library}
        name={name}
        size={size}
        uniProps={theme => ({color: color ?? theme.colors.iconPrimary})}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
  },
}));

export default IconButton;
