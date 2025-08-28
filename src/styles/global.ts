import {StyleSheet} from 'react-native-unistyles';

export const globalStyles = StyleSheet.create(theme => ({
  // Reusable layout styles
  container: {
    flex: 1,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Typography presets
  h1: {
    fontSize: theme.fonts.size['4xl'],
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
  },
  h2: {
    fontSize: theme.fonts.size['3xl'],
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  body: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.regular,
    color: theme.colors.textSecondary,
  },
}));
