import React from 'react';
import {Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

interface ShoppingListHeaderProps {
  title: string;
}

const ShoppingListHeader: React.FC<ShoppingListHeaderProps> = ({title}) => {
  return <Text style={styles.header}>{title}</Text>;
};

const styles = StyleSheet.create(theme => ({
  header: {
    fontSize: theme.fonts.size['3xl'],
    fontWeight: theme.fonts.weight.bold,
    marginBottom: 16,
  },
}));

export default ShoppingListHeader;
