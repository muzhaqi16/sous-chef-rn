import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface TabMainScreenProps {
  children: React.ReactNode;
  testID?: string;
}

/**
 * Root container for the top-level screens of each HomeTabs stack
 * (PantryMain, ShoppingListMain, RecipeMain, MealPlanMain).
 *
 * Centralizes the top spacing below the status bar so every tab is
 * visually aligned. This is the single source of truth for that spacing —
 * do not re-apply marginTop/paddingTop in individual headers.
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
