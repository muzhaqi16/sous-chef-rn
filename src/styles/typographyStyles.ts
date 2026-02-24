import { StyleSheet } from 'react-native-unistyles';
import type { AnyTheme } from '#/theme/themes';

/**
 * Typography and interaction state style definitions.
 */
export const typographyDefs = (theme: AnyTheme) => ({
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
  h3: {
    fontSize: theme.fonts.size['2xl'],
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  body: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.regular,
    color: theme.colors.textPrimary,
  },
  bodySecondary: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.regular,
    color: theme.colors.textSecondary,
  },
  title: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
  },
  caption: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.regular,
    color: theme.colors.textSecondary,
  },
  link: {
    color: theme.colors.primary,
    textDecorationLine: 'underline' as const,
  },

  // Interaction states
  pressed: {
    opacity: theme.opacity.pressed,
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  cardPressed: {
    opacity: theme.opacity.cardPressed,
  },
});

export const typographyStyles = StyleSheet.create(theme => typographyDefs(theme));
