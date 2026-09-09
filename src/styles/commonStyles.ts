import { StyleSheet } from 'react-native-unistyles';

/**
 * All primitives live INSIDE one `StyleSheet.create` factory: the Unistyles
 * babel plugin AST-analyzes the factory body for `theme.*` reads, and a read
 * inside an imported helper is opaque to it — those styles freeze at their
 * initial values. Do not split this into helper files.
 */

export const commonStyles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

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

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: theme.borderWidth.hairline,
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

  scrollContent: {
    flexGrow: 1,
  },

  input: {
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.smPlus,
    ...theme.type.body,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.inputBackground,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    ...theme.type.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },

  button: {
    paddingVertical: {
      xs: theme.spacing.sm,
      md: theme.spacing.md,
    },
    paddingHorizontal: {
      xs: theme.spacing.md,
      md: theme.spacing.lg,
    },
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
  },
  buttonTextPrimary: {
    color: theme.colors.onPrimary,
  },
  buttonTextSecondary: {
    color: theme.colors.textPrimary,
  },

  settingsSection: {
    padding: theme.spacing.md,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  settingsSectionTitle: {
    ...theme.type.bodyStrong,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  settingsInputGroup: {
    marginBottom: theme.spacing.md,
  },
  settingsLabel: {
    ...theme.type.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.base,
  },
  settingsRowInfo: {
    flex: 1,
    marginRight: theme.spacing.base,
  },
  settingsRowLabel: {
    ...theme.type.bodyStrong,
    color: theme.colors.textPrimary,
  },
  settingsRowDescription: {
    ...theme.type.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },

  // The row's own `gap` spaces this from the text, so it carries no margin.
  listItemImageContainerCompact: {
    width: theme.sizes.itemCard.compact.image,
    height: theme.sizes.itemCard.compact.image,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    // Hairline border + tinted fill, so an empty placeholder tile reads as a
    // deliberate thumbnail rather than a gap.
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surfaceVariant,
    ...theme.shadows.sm,
  },
  listItemImageCompact: {
    width: theme.sizes.itemCard.compact.image,
    height: theme.sizes.itemCard.compact.image,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    resizeMode: 'cover',
  },
  // The list row, defined once for the four shells that compose one:
  // `rowWrapper` is its place in the list, `rowSurface` the card, `rowContent`
  // the slots inside it. Its text roles are `rowType` in `theme/foundations`.
  // No horizontal inset: the list that renders the row owns the page gutter,
  // so a row placing itself would be the second author of one edge.
  rowWrapper: {
    marginBottom: theme.layout.rowGap,
  },
  rowSurface: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    // A status variant paints this border; the default row relies on the
    // shadow alone and keeps a transparent one, so every row is the same
    // height whether or not it carries a status.
    borderWidth: theme.borderWidth.medium,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.layout.rowSlotGap,
    padding: theme.layout.rowInset,
    // `minHeight`, not a height: a two-line title grows rather than clips.
    minHeight: theme.sizes.itemCard.compact.height,
  },
  rowTextGap: {
    marginTop: theme.layout.rowTextGap,
  },
  // Rounds a press ripple to the row. It sits on the node INSIDE `rowSurface`,
  // never on the surface itself, which would clip its own shadow away.
  rowClip: {
    overflow: 'hidden',
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
  },

  shadow: theme.shadows.card,

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    ...theme.type.body,
    color: theme.colors.textSecondary,
  },

  bottomSheetScrollView: {
    flex: 1,
  },
  bottomSheetContent: {
    padding: theme.spacing.md,
  },
  bottomSheetLoading: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheetItemInfo: {
    marginBottom: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  bottomSheetItemName: {
    ...theme.type.heading,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  bottomSheetItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomSheetItemLabel: {
    ...theme.type.body,
    color: theme.colors.textSecondary,
  },
  bottomSheetSection: {
    marginBottom: theme.spacing.md,
  },
  bottomSheetSectionLabel: {
    ...theme.type.label,
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
    ...theme.type.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  bottomSheetHelperTextError: {
    color: theme.colors.error,
  },
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
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.xs,
  },
  bottomSheetOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceVariant,
  },
  bottomSheetOptionText: {
    ...theme.type.caption,
    color: theme.colors.textSecondary,
  },
  bottomSheetOptionTextSelected: {
    color: theme.colors.primary,
    ...theme.type.bodyStrong,
  },

  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
  },
  badgeText: {
    ...theme.type.label,
    color: theme.colors.onPrimary,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.chipBackground,
    marginRight: theme.spacing.sm,
  },
  chipText: {
    ...theme.type.label,
    color: theme.colors.chipText,
  },
  body: {
    ...theme.type.body,
    color: theme.colors.textPrimary,
  },
  bodySecondary: {
    ...theme.type.body,
    color: theme.colors.textSecondary,
  },
  title: {
    ...theme.type.heading,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    ...theme.type.bodyStrong,
    color: theme.colors.textSecondary,
  },
  caption: {
    ...theme.type.caption,
    color: theme.colors.textSecondary,
  },
}));
