import React from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import IconButton from '../atoms/IconButton';

type Props = {
  onAddPress: () => void;
};

const styles = StyleSheet.create(theme => ({
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
  return (
    <View style={styles.container}>
      <IconButton
        name="add"
        onPress={onAddPress}
        size={30}
        style={styles.addButton}
        color="#FF8A4C"
      />
    </View>
  );
};

export default ShoppingListFooter;
