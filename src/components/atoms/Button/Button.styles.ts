import {StyleSheet} from 'react-native-unistyles';

export default StyleSheet.create((theme, rt) => ({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    flexDirection: 'row',
    gap: theme.spacing.xs,

    // Base responsive padding with breakpoints
    paddingVertical: {
      xs: theme.spacing.sm,
      md: theme.spacing.md,
    },
    paddingHorizontal: {
      xs: theme.spacing.md,
      md: theme.spacing.lg,
    },

    variants: {
      variant: {
        primary: {
          backgroundColor: theme.colors.primary,
          borderWidth: 1.5,
          borderColor: theme.colors.primary,
        },
        secondary: {
          backgroundColor: theme.colors.surface,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
        },
        ghost: {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: 'transparent',
        },
        default: {
          backgroundColor: theme.colors.primary,
          borderWidth: 1.5,
          borderColor: theme.colors.primary,
        },
      },
      size: {
        small: {
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
        },
        medium: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
        },
        large: {
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
        },
        default: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
        },
      },
      disabled: {
        true: {
          opacity: 0.5,
        },
      },
      fullWidth: {
        true: {
          width: '100%',
        },
      },
    },
  },

  text: {
    fontSize: theme.fonts.size.md,
    fontWeight: '600',

    variants: {
      variant: {
        primary: {
          color: theme.colors.white,
        },
        secondary: {
          color: theme.colors.textPrimary,
        },
        ghost: {
          color: theme.colors.primary,
        },
        default: {
          color: theme.colors.white,
        },
      },
      size: {
        small: {
          fontSize: theme.fonts.size.sm,
        },
        medium: {
          fontSize: theme.fonts.size.md,
        },
        large: {
          fontSize: theme.fonts.size.lg,
        },
        default: {
          fontSize: theme.fonts.size.md,
        },
      },
    },
  },
}));
