import React from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

export const Divider: React.FC = () => {
  return <View style={styles.divider} />;
};

const styles = StyleSheet.create(theme => ({
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    width: '100%',
  },
}));
