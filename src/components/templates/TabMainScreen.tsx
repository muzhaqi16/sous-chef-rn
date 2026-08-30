import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface TabMainScreenProps {
  children: React.ReactNode;
  testID?: string;
}

/**
 * Root container for each HomeTabs stack's top-level screen, and the single source
 * of the top spacing below the status bar — never re-apply it in a header.
 */
export const TabMainScreen: React.FC<TabMainScreenProps> = ({
  children,
  testID,
}) => (
  <View style={styles.container} testID={testID}>
    {children}
  </View>
);

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.sm,
  },
}));
