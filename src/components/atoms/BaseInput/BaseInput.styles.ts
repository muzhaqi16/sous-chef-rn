import { StyleSheet } from 'react-native-unistyles';

export default StyleSheet.create((theme, _rt) => ({
  container: {
    gap: theme.spacing.xs,
    marginVertical: {
      xs: theme.spacing.sm,
      md: theme.spacing.md,
    },
  },

  label: {
    fontSize: {
      xs: theme.fonts.size.sm,
      md: theme.fonts.size.md,
    },
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
    marginBottom: {
      xs: theme.spacing.xs,
      md: theme.spacing.sm,
    },
  },

  // Dynamic function for input container with focus and error states
  inputContainer: (isFocused: boolean, hasError: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: hasError
      ? theme.colors.error
      : isFocused
      ? theme.colors.primary
      : theme.colors.border,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.inputBackground,
    minHeight: {
      xs: 44,
      sm: 48,
      md: 52,
    },
  }),

  input: {
    flex: 1,
    fontSize: {
      xs: theme.fonts.size.sm,
      md: theme.fonts.size.md,
    },
    color: theme.colors.textPrimary,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: {
      xs: theme.spacing.sm,
      md: theme.spacing.md,
    },
    paddingVertical: 0,
    // Natural line height for text/cursor
    lineHeight: {
      xs: theme.fonts.size.sm * 1.5,
      md: theme.fonts.size.md * 1.5,
    },
  },

  iconWrapper: {
    marginLeft: {
      xs: theme.spacing.sm,
      md: theme.spacing.md,
    },
    paddingRight: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Dynamic function for error text with animation state
  errorText: (hasError: boolean) => ({
    fontSize: {
      xs: theme.fonts.size.xs,
      md: theme.fonts.size.sm,
    },
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
    // Animate visibility
    opacity: hasError ? 1 : 0,
    maxHeight: hasError ? 50 : 0,
    overflow: 'hidden',
  }),
}));
