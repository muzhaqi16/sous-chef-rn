import { StyleSheet } from 'react-native-unistyles';
import type { AnyTheme } from '#/theme/themes';
import { defineStyles } from './defineStyles';

/**
 * Modal and bottom sheet style definitions.
 */
export const modalDefs = (theme: AnyTheme) =>
  defineStyles({
    // Modals
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: theme.fonts.size.lg,
      fontWeight: theme.fonts.weight.semibold,
      color: theme.colors.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    modalContent: {
      padding: theme.spacing.md,
    },

    // Bottom sheet item modals
    bottomSheetScrollView: {
      flex: 1,
    },
    bottomSheetContent: {
      padding: theme.spacing.md,
    },
    bottomSheetItemInfo: {
      marginBottom: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: theme.radii.md,
    },
    bottomSheetItemName: {
      fontSize: theme.fonts.size.lg,
      fontWeight: theme.fonts.weight.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    bottomSheetItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    bottomSheetItemLabel: {
      fontSize: theme.fonts.size.base,
      color: theme.colors.textSecondary,
    },
    bottomSheetSection: {
      marginBottom: theme.spacing.md,
    },
    bottomSheetSectionLabel: {
      fontSize: theme.fonts.size.sm,
      fontWeight: theme.fonts.weight.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    bottomSheetInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: theme.spacing.xs,
    },
    bottomSheetHelperText: {
      fontSize: theme.fonts.size.sm,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    bottomSheetHelperTextError: {
      color: theme.colors.error,
    },

    // Chip/Option selection (for purpose, waste reason, etc.)
    bottomSheetOptionContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    bottomSheetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      gap: theme.spacing.xs,
    },
    bottomSheetOptionSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surfaceVariant,
    },
    bottomSheetOptionText: {
      fontSize: theme.fonts.size.sm,
      color: theme.colors.textSecondary,
    },
    bottomSheetOptionTextSelected: {
      color: theme.colors.primary,
      fontWeight: theme.fonts.weight.semibold,
    },
  });

export const modalStyles = StyleSheet.create(theme => modalDefs(theme));
