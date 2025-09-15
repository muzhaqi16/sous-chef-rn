// src/organisms/ShoppingListFooter.tsx
import React from 'react';
import {View} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import IconButton from '../atoms/IconButton';

type Props = {
  onAddPress: () => void;
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: theme.colors.white,
    borderRadius: 30,
    padding: 10,
  },
}));

const ShoppingListFooter: React.FC<Props> = ({onAddPress}) => {
  const {styles} = useStyles(stylesheet);
  return (
    <View style={styles.container}>
      <IconButton
        iconName="add"
        onPress={onAddPress}
        size={30}
        style={styles.addButton}
        color="#FF8A4C"
      />
    </View>
  );
};

export default ShoppingListFooter;
