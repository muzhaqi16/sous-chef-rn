import React from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {ListItems, AddItemBottomSheet} from '../components';
import {ShoppingListSector} from '../components/organisms/ShoppingListSelector';

const ShoppingListScreen = () => {
  const {styles} = useStyles(stylesheet);
  return (
    <GestureHandlerRootView style={styles.container}>
      <ShoppingListSector />
      <ListItems />
      <AddItemBottomSheet />
    </GestureHandlerRootView>
  );
};
const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    padding: 16,
  },
}));
export default ShoppingListScreen;
