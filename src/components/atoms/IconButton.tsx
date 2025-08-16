import React from 'react';
import {TouchableOpacity, StyleProp, ViewStyle} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {IconLibrary, Icon} from '#/utils/iconUtils';

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
  const {styles, theme} = useStyles(stylesheet);

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
      <Icon
        library={library}
        name={name}
        size={size}
        color={color ?? theme.colors.iconPrimary}
      />
    </TouchableOpacity>
  );
};

const stylesheet = createStyleSheet(theme => ({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
  },
}));

export default IconButton;
