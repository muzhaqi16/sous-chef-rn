import React from 'react';
import {TouchableOpacity} from 'react-native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import {Icon, IconName, IconLibrary} from '#utils/iconUtils';

interface FABProps {
  onPress?: () => void;
  icon?: IconName;
  library?: IconLibrary;
  position?: {bottom?: number; right?: number; left?: number; top?: number};
}

export const FAB: React.FC<FABProps> = ({
  onPress = () => {},
  icon = 'add',
  library = 'MaterialIcons',
  position = {bottom: 20, right: 20},
}) => {
  const {styles} = useStyles(fabStyles);

  return (
    <TouchableOpacity style={[styles.fab, position]} onPress={onPress}>
      <Icon name={icon} size={24} color="white" library={library} />
    </TouchableOpacity>
  );
};

const fabStyles = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
}));
