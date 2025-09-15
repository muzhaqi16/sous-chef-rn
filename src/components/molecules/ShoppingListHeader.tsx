import React from 'react';
import {Text} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

interface ShoppingListHeaderProps {
  title: string;
}

const ShoppingListHeader: React.FC<ShoppingListHeaderProps> = ({title}) => {
  const {styles} = useStyles(stylesheet);
  return <Text style={styles.header}>{title}</Text>;
};

const stylesheet = createStyleSheet(theme => ({
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
}));

export default ShoppingListHeader;
