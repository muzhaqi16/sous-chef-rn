import React from 'react';
import {View, Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

export const NotFoundScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        This screen doesn't exist. Please check the URL or navigate back to a
        valid screen.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  text: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
}));

export default NotFoundScreen;
