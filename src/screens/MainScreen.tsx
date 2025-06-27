import React, {useEffect} from 'react';
import {View, Text} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {useStore} from '../store/useStore';

export const MainScreen = () => {
  const {styles} = useStyles(stylesheet);

  const {pantryItems, fetchPantryItems} = useStore();

  // Fetch pantry items when the component mounts
  // This ensures that pantry items are available when the component is rendered
  useEffect(() => {
    fetchPantryItems().catch(error => {
      console.error('Error fetching pantry items:', error);
    });
  }, [fetchPantryItems]);

  // Log the pantry items to verify they are fetched correctly
  console.log('Pantry Items:', pantryItems);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome to the Pantry!</Text>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
}));

export default MainScreen;
