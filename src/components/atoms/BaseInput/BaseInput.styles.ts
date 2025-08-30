import {StyleSheet} from 'react-native-unistyles';

export default StyleSheet.create((theme, rt) => ({
  label: {
    // Only overrides to commonStyles.label if needed
    fontSize: 15, // Specific override from common 14
  },
  inputRow: {
    // Additional styles not in commonStyles.input
    paddingHorizontal: theme.spacing.md,
    height: {
      sm: 44,
      md: 48,
    },
  },
  input: {
    // Reset some defaults for the actual TextInput
    backgroundColor: 'transparent',
    borderWidth: 0,
    fontSize: 15,
    padding: 0,
  },
  iconWrapper: {
    marginLeft: theme.spacing.sm,
  },
  errorText: {
    // Any specific overrides to commonStyles.errorText
    fontSize: 13, // Specific override from common 12
  },
}));
