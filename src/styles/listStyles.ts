import { StyleSheet } from 'react-native-unistyles';
import type { AnyTheme } from '#/theme/themes';

const shadowStyle = {
  boxShadow: [
    {
      offsetX: 0,
      offsetY: 4,
      blurRadius: 15,
      spreadDistance: 1,
      color: 'rgba(0, 0, 0, 0.1)',
    },
  ],
};

/**
 * List, empty state, and loading style definitions.
 */
export const listDefs = (theme: AnyTheme) => ({
  // List items
  listItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  listItemSubtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  listItemImageContainer: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    marginRight: theme.spacing.sm,
    borderRadius: theme.radii.md,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    ...shadowStyle,
  },
  listItemImage: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    borderRadius: theme.radii.md,
    resizeMode: 'cover' as const,
  },
  listItemImageContainerCompact: {
    width: theme.sizes.itemCard.compact.image,
    height: theme.sizes.itemCard.compact.image,
    marginRight: theme.spacing['3'],
    borderRadius: theme.radii.md,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    ...shadowStyle,
  },
  listItemImageCompact: {
    width: theme.sizes.itemCard.compact.image,
    height: theme.sizes.itemCard.compact.image,
    borderRadius: theme.radii.md,
    resizeMode: 'cover' as const,
  },

  // Reusable shadow
  shadow: shadowStyle,

  // Empty states
  emptyState: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: theme.spacing.xl,
  },
  emptyStateIcon: {
    marginBottom: theme.spacing.md,
  },
  emptyStateTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center' as const,
  },
  emptyStateText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.lg,
  },

  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
  },
});

export const listStyles = StyleSheet.create(theme => listDefs(theme));
