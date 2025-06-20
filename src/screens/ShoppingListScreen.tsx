import React from 'react';
import {View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {ListItems} from '../components';
import SearchBar from '../components/molecules/SearchBar';
import {type HomeTabScreenProps} from '../navigation/types';
import {useNavigation} from '@react-navigation/native';
import {ShoppingListSelector} from '../components/organisms/ShoppingListSelector';
import ShoppingListHeader from '../components/organisms/ShoppingListHeader';
import AddButton from '../components/molecules/AddButton';

const ShoppingListScreen = () => {
  const {styles} = useStyles(stylesheet);
  const navigation =
    useNavigation<HomeTabScreenProps<'ShoppingList'>['navigation']>();
  return (
    <GestureHandlerRootView style={styles.container}>
      <ShoppingListHeader />
      <View style={styles.actionBar}>
        <SearchBar />
        <ShoppingListSelector />
        <AddButton onPress={() => {}} />
      </View>
      <ListItems />
    </GestureHandlerRootView>
  );
};
const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    padding: 16,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
}));
export default ShoppingListScreen;
