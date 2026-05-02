import { StyleSheet } from 'react-native-unistyles';
import type { AnyTheme } from '#/theme/themes';
import { defineStyles } from './defineStyles';

/**
 * Component style definitions — badges, chips, FAB.
 */
export const componentDefs = (theme: AnyTheme) =>
  defineStyles({
    // Badges
    badge: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primary,
    },
    badgeText: {
      fontSize: theme.fonts.size.xs,
      fontWeight: theme.fonts.weight.semibold,
      color: theme.colors.white,
    },

    // Chips
    chip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.chipBackground,
      marginRight: theme.spacing.sm,
    },
    chipText: {
      fontSize: theme.fonts.size.sm,
      fontWeight: theme.fonts.weight.medium,
      color: theme.colors.chipText,
    },
    chipSelected: {
      backgroundColor: theme.colors.chipSelectedBackground,
    },
    chipTextSelected: {
      color: theme.colors.chipSelectedText,
    },

    // FAB
    fab: {
      position: 'absolute',
      bottom: theme.spacing['5'],
      right: theme.spacing['5'],
      width: 56,
      height: 56,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...theme.shadows.lg,
    },
  });

export const componentStyles = StyleSheet.create(theme => componentDefs(theme));
