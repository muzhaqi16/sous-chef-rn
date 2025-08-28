import {StyleSheet} from 'react-native-unistyles';

export const mixins = StyleSheet.create(theme => ({
  // Card elevation
  cardShadow: {
    shadowColor: theme.colors.primaryDark,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Input field base
  inputBase: {
    height: 48,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    color: theme.colors.inputText,
  },
}));

// Usage
// const styles = StyleSheet.create(theme => ({
//   card: {
//     ...mixins.cardShadow,
//     padding: theme.spacing.md,
//     backgroundColor: theme.colors.surface,
//   },
// }));
