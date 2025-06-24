import React from 'react';
import {View} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

export const Divider: React.FC = () => {
  const {styles} = useStyles(stylesheet);
  return <View style={styles.divider} />;
};

const stylesheet = createStyleSheet(theme => ({
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    width: '100%',
  },
}));
