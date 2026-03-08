import { StyleSheet } from 'react-native-unistyles';
import type { AnyTheme } from '#/theme/themes';
import { defineStyles } from './defineStyles';

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
export const listDefs = (theme: AnyTheme) => defineStyles({
  // List items
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    ...shadowStyle,
  },
  listItemImage: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    borderRadius: theme.radii.md,
    resizeMode: 'cover',
  },
  listItemImageContainerCompact: {
    width: theme.sizes.itemCard.compact.image,
    height: theme.sizes.itemCard.compact.image,
    marginRight: theme.spacing['3'],
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    ...shadowStyle,
  },
  listItemImageCompact: {
    width: theme.sizes.itemCard.compact.image,
    height: theme.sizes.itemCard.compact.image,
    borderRadius: theme.radii.md,
    resizeMode: 'cover',
  },

  // Reusable shadow
  shadow: shadowStyle,

  // Empty states
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },

  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
  },
});

export const listStyles = StyleSheet.create(theme => listDefs(theme));
