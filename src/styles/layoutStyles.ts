import { StyleSheet } from 'react-native-unistyles';
import type { AnyTheme } from '#/theme/themes';
import { defineStyles } from './defineStyles';

/**
 * Layout style definitions — containers, surfaces, cards, flex, spacing, headers, dividers, and utility.
 * Export the raw definitions for composition in commonStyles.
 */
export const layoutDefs = (theme: AnyTheme) =>
  defineStyles({
    // Containers
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    containerPadded: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.md,
    },
    containerCentered: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Surfaces
    surface: {
      backgroundColor: theme.colors.surface,
    },
    surfaceRounded: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.md,
      borderCurve: 'continuous',
    },

    // Cards
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      borderCurve: 'continuous',
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    cardWithShadow: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.md,
      borderCurve: 'continuous',
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      boxShadow: [
        {
          offsetX: 0,
          offsetY: 2,
          blurRadius: 4,
          spreadDistance: 0,
          color: `${theme.colors.primaryDark}1A`,
        },
      ],
    },
    bottomBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },

    // Flex patterns
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rowSpaceBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rowCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    column: {
      flexDirection: 'column',
    },
    flex1: {
      flex: 1,
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Spacing
    paddingHorizontal: {
      paddingHorizontal: theme.spacing.md,
    },
    paddingVertical: {
      paddingVertical: theme.spacing.md,
    },
    padding: {
      padding: theme.spacing.md,
    },
    paddingSmall: {
      padding: theme.spacing.sm,
    },
    paddingLarge: {
      padding: theme.spacing.lg,
    },
    marginBottom: {
      marginBottom: theme.spacing.md,
    },
    marginBottomSmall: {
      marginBottom: theme.spacing.sm,
    },
    marginBottomLarge: {
      marginBottom: theme.spacing.lg,
    },
    gap: {
      gap: theme.spacing.md,
    },
    gapSmall: {
      gap: theme.spacing.sm,
    },
    gapLarge: {
      gap: theme.spacing.lg,
    },

    // Headers
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingVertical: {
        xs: theme.spacing.sm,
        md: theme.spacing.md,
      },
      paddingHorizontal: {
        xs: theme.spacing.sm,
        md: theme.spacing.md,
        lg: theme.spacing.lg,
      },
    },
    headerTitle: {
      fontSize: theme.fonts.size.lg,
      fontWeight: theme.fonts.weight.semibold,
      color: theme.colors.textPrimary,
    },
    headerAction: {
      padding: theme.spacing.xs,
    },
    headerPlaceholder: {
      width: 24,
    },

    // Dividers
    divider: {
      height: 1,
      backgroundColor: theme.colors.divider,
    },
    dividerVertical: {
      width: 1,
      backgroundColor: theme.colors.divider,
    },

    // Utility
    absoluteFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.overlay,
    },
    scrollContent: {
      flexGrow: 1,
    },
  });

export const layoutStyles = StyleSheet.create(theme => layoutDefs(theme));
