import {StyleSheet} from 'react-native-unistyles';

export default StyleSheet.create(theme => ({
  button: {
    // Only variant-specific overrides that aren't in commonStyles
    variants: {
      variant: {
        ghost: {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: 'transparent',
        },
        default: {},
      },
      size: {
        small: {
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
        },
        medium: {}, // Uses commonStyles.button defaults
        large: {
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
        },
        default: {},
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
    // Only specific overrides
    variants: {
      variant: {
        ghost: {
          color: theme.colors.primary,
        },
        default: {},
      },
      size: {
        small: {
          fontSize: theme.fonts.size.sm,
        },
        medium: {}, // Uses commonStyles.buttonText defaults
        large: {
          fontSize: theme.fonts.size.lg,
        },
        default: {},
      },
    },
  },
}));
