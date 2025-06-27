import React, {useState} from 'react';
import {View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {ShoppingListItems} from '../components';
import SearchBar from '../components/molecules/SearchBar';
import {ShoppingListSelector} from '../components/organisms/ShoppingListSelector';
import AddButton from '../components/molecules/AddButton';
import {AddItemBottomSheet} from '../components';

const ShoppingListScreen = () => {
  const {styles} = useStyles(stylesheet);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.actionBar}>
        <SearchBar style={styles.searchBar} />
        <ShoppingListSelector />
        <AddButton
          onPress={() => {
            setShowBottomSheet(true);
          }}
        />
      </View>
      <ShoppingListItems />
      <AddItemBottomSheet
        isVisible={showBottomSheet}
        onClose={() => {
          setShowBottomSheet(false);
        }}
      />
    </GestureHandlerRootView>
  );
};
const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    padding: theme.spacing.padding.sm,
    backgroundColor: theme.colors.background,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  searchBar: {},
}));
export default ShoppingListScreen;
