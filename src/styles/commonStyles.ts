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

  surface: {
    backgroundColor: theme.colors.surface,
  },
  surfaceRounded: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
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
  bottomBorder: {
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
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
  headerTitle: {
    ...theme.type.heading,
    color: theme.colors.textPrimary,
  },
  headerAction: {
    padding: theme.spacing.xs,
  },
  headerPlaceholder: {
    width: 24,
  },

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
  inputError: {
    borderColor: theme.colors.error,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    ...theme.type.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    ...theme.type.caption,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
  buttonDanger: {
    backgroundColor: theme.colors.error,
  },
  buttonText: {
    ...theme.type.bodyStrong,
  },
  buttonTextPrimary: {
    color: theme.colors.onPrimary,
  },
  buttonTextSecondary: {
    color: theme.colors.textPrimary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  iconButton: {
    padding: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
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

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    ...theme.type.bodyStrong,
    color: theme.colors.textPrimary,
  },
  listItemSubtitle: {
    ...theme.type.caption,
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
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.primary,
    ...theme.shadows.card,
  },
  listItemImage: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    resizeMode: 'cover',
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
  rowWrapper: {
    marginHorizontal: theme.layout.rowGutter,
    marginBottom: theme.layout.rowGap,
  },
  rowSurface: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    // A status variant paints this border; the default row relies on the
    // shadow alone and keeps a transparent one to preserve sizing.
    borderWidth: theme.borderWidth.hairline,
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

  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    ...theme.type.heading,
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    padding: theme.spacing.md,
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
  chipSelected: {
    backgroundColor: theme.colors.chipSelectedBackground,
  },
  chipTextSelected: {
    color: theme.colors.chipSelectedText,
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
  link: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },

  pressed: {
    opacity: theme.opacity.pressed,
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  cardPressed: {
    opacity: theme.opacity.cardPressed,
  },
}));
