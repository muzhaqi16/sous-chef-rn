import React from 'react';
import {View, Text} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

export const NotFoundScreen = () => {
  const {styles} = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        This screen doesn't exist. Please check the URL or navigate back to a
        valid screen.
      </Text>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  text: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
}));

export default NotFoundScreen;
