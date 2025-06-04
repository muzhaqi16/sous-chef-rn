import React from 'react';
import {View, Text, Image} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import IconButton from '../atoms/IconButton';

const ShoppingListHeader: React.FC = ({}) => {
  const {styles, theme} = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>PANT</Text>
        <Text style={[styles.title, {color: theme.colors.primary}]}>RY</Text>
      </View>
      {/* Placeholder avatar; replace with actual user image */}
      <Image
        style={styles.avatar}
        source={{
          uri: 'https://i.pravatar.cc/300',
        }}
      />
    </View>
  );
};
const stylesheet = createStyleSheet(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.padding.sm,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.typography,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
}));

export default ShoppingListHeader;
