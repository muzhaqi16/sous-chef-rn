import {StyleSheet} from 'react-native-unistyles';

export default StyleSheet.create(theme => ({
  button: {
    // Base responsive styles using v3 breakpoint syntax
    paddingVertical: {
      xs: theme.spacing.sm,
      md: theme.spacing.md,
    },
    paddingHorizontal: {
      xs: theme.spacing.md,
      md: theme.spacing.lg,
    },
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',

    variants: {
      variant: {
        primary: {
          backgroundColor: theme.colors.primary,
        },
        secondary: {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        ghost: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: 'transparent',
        },
      },
      size: {
        small: {
          paddingVertical: {
            xs: theme.spacing.xs,
            md: theme.spacing.sm,
          },
          paddingHorizontal: {
            xs: theme.spacing.sm,
            md: theme.spacing.md,
          },
        },
        medium: {
          // Uses base responsive defaults - empty variant
        },
        large: {
          paddingVertical: {
            xs: theme.spacing.md,
            md: theme.spacing.lg,
          },
          paddingHorizontal: {
            xs: theme.spacing.lg,
            md: theme.spacing.xl,
          },
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

    compoundVariants: [
      {
        variant: 'ghost',
        disabled: true,
        styles: {
          borderColor: theme.colors.border,
          opacity: 0.3,
        },
      },
      {
        variant: 'primary',
        size: 'large',
        styles: {
          ...theme.shadows.md,
        },
      },
    ],
  },

  text: {
    fontSize: {
      xs: theme.fonts.size.sm,
      md: theme.fonts.size.md,
    },
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'center',

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
      },
      size: {
        small: {
          fontSize: {
            xs: theme.fonts.size.xs,
            md: theme.fonts.size.sm,
          },
        },
        medium: {
          // Uses base responsive defaults - empty variant
        },
        large: {
          fontSize: {
            xs: theme.fonts.size.md,
            md: theme.fonts.size.lg,
          },
        },
      },
    },
  },

  // Dynamic function for loading state
  loadingContainer: (isLoading: boolean) => ({
    opacity: isLoading ? 0 : 1,
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  }),
}));
