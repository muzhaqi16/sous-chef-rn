import {StyleSheet} from 'react-native-unistyles';

export const commonStyles = StyleSheet.create((theme, rt) => ({
  // Containers
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  safeContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom,
  },

  paddedContainer: {
    flex: 1,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },

  // Cards
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },

  cardPressed: {
    ...theme.shadows.none,
    opacity: 0.95,
  },

  // Buttons
  buttonBase: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },

  // Text styles
  title: {
    fontSize: theme.typography.fontSize['2xl'],
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },

  subtitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textSecondary,
  },

  body: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    lineHeight:
      theme.typography.fontSize.base * theme.typography.lineHeight.normal,
  },

  caption: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },

  // Form elements
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.inputBackground,
  },

  inputFocused: {
    borderColor: theme.colors.primary,
  },

  inputError: {
    borderColor: theme.colors.error,
  },

  // Layout utilities
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rowSpaced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Responsive styles using media queries
  responsiveContainer: {
    padding: theme.spacing.md,
    ...{
      ':w[0, sm]': {
        padding: theme.spacing.sm,
      },
      ':w[md]': {
        padding: theme.spacing.lg,
        maxWidth: theme.sizes.container.md,
        alignSelf: 'center',
        width: '100%',
      },
      ':w[lg]': {
        padding: theme.spacing.xl,
        maxWidth: theme.sizes.container.lg,
      },
    },
  },
}));
