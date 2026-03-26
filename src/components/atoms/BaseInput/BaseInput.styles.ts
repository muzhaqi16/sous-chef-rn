import { StyleSheet } from 'react-native-unistyles';

export default StyleSheet.create(theme => ({
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

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.inputBackground,
    minHeight: {
      xs: 44,
      sm: 48,
      md: 52,
    },
    variants: {
      focused: {
        true: { borderColor: theme.colors.primary },
      },
      error: {
        true: { borderColor: theme.colors.error },
      },
    },
  },

  input: {
    flex: 1,
    alignSelf: 'stretch',
    textAlignVertical: 'center',
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
  },

  inputWithRightIcon: {
    paddingRight: {
      xs: 44,
      md: 48,
    },
  },

  leftIconWrapper: {
    marginLeft: {
      xs: theme.spacing.sm,
      md: theme.spacing.md,
    },
    marginRight: {
      xs: theme.spacing.sm,
      md: theme.spacing.md,
    },
    justifyContent: 'center',
    alignItems: 'center',
  },

  rightIconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    variants: {
      rightIcon: {
        true: {
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          marginLeft: 0,
          paddingHorizontal: {
            xs: theme.spacing.sm,
            md: theme.spacing.md,
          },
        },
      },
    },
  },

  errorText: {
    fontSize: {
      xs: theme.fonts.size.xs,
      md: theme.fonts.size.sm,
    },
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
    overflow: 'hidden',
    opacity: 0,
    maxHeight: 0,
    variants: {
      visible: {
        true: { opacity: 1, maxHeight: 50 },
      },
    },
  },

  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
