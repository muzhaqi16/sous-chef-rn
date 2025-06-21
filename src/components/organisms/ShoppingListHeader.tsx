import React from 'react';
import {View, Text, Image} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import IconButton from '../atoms/IconButton';
import {useStore} from '../../store/useStore';

const ShoppingListHeader: React.FC = ({}) => {
  const {styles, theme} = useStyles(stylesheet);

  const avatarUrl = useStore(state => state.avatarUrl);

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
          uri: avatarUrl || 'https://via.placeholder.com/40',
        }}
      />
    </View>
  );
};
const stylesheet = createStyleSheet(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.padding.lg,
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
    color: theme.colors.textPrimary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
}));

export default ShoppingListHeader;
