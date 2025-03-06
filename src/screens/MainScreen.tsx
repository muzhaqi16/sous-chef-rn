import React from 'react';
import {View} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import ShoppingList from '../components/organisms/ShoppingList';

const MainScreen = () => {
  const {styles} = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      <ShoppingList />
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));

export default MainScreen;
