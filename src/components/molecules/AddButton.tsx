import React from 'react';
import {Text, StyleSheet, View} from 'react-native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import IconButton from '../atoms/IconButton';

type AddButtonProps = {
  onPress: () => void;
};

const AddButton: React.FC<AddButtonProps> = ({onPress}) => {
  const {styles, theme} = useStyles(stylesheet);

  return (
    <View style={styles.button}>
      <IconButton
        iconName="add"
        size={24}
        color={theme.colors.primary}
        onPress={onPress}
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
