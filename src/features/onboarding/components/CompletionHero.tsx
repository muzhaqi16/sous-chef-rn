import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';

/** The completion screen's opening: the check that says setup is done. */
export const CompletionHero = () => (
  <View style={styles.check}>
    <Icon name="checkmark" size={44} tone="onSuccess" />
  </View>
);

const styles = StyleSheet.create(theme => ({
  check: {
    width: 80,
    height: 80,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
  },
}));
