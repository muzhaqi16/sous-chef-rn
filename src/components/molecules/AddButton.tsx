import React from 'react';
import {Text, View} from 'react-native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import IconButton from '../atoms/IconButton';
import Ionicons from '@react-native-vector-icons/ionicons';

type AddButtonProps = {
  onPress: () => void;
};

const AddButton: React.FC<AddButtonProps> = ({onPress}) => {
  const {styles, theme} = useStyles(stylesheet);

  return (
    <View style={styles.button}>
      <IconButton
        name="add"
        size={24}
        color={theme.colors.primary}
        onPress={onPress}
        library={Ionicons}
      />
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
    borderRadius: 16,
    width: 44,
    height: 44,
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
}));
export default AddButton;
