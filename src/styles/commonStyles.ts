import { StyleSheet } from 'react-native-unistyles';

/**
 * Common shadow definition
 */
const shadowStyle = {
  boxShadow: [
    {
      offsetX: 0,
      offsetY: 4,
      blurRadius: 15,
      spreadDistance: 1,
      color: '#0000001A',
    },
  ],
};

/**
 * Common style patterns used throughout the application
 * Uses theme values for consistency
 */
export const commonStyles = StyleSheet.create(theme => ({
  // ============= LAYOUT PATTERNS =============

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
  },

  // Cards
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },

  cardWithShadow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    shadowColor: theme.colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  bottomBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  // ============= FLEX PATTERNS =============

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

  // ============= SPACING PATTERNS =============

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

  // ============= HEADERS =============

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
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },

  headerAction: {
    padding: theme.spacing.xs,
  },

  headerPlaceholder: {
    width: 24,
  },

  // ============= FORM ELEMENTS =============

  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    fontSize: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },

  errorText: {
    fontSize: 12,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },

  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // ============= BUTTONS =============

  button: {
    paddingVertical: {
      xs: theme.spacing.sm,
      md: theme.spacing.md,
    },
    paddingHorizontal: {
      xs: theme.spacing.md,
      md: theme.spacing.lg,
    },
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },

  buttonSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  buttonDanger: {
    backgroundColor: theme.colors.error,
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  buttonTextPrimary: {
    color: theme.colors.white,
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

  // ============= LISTS =============

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
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },

  listItemSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },

  listItemImageContainer: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    marginRight: theme.spacing.sm,
    borderRadius: theme.radii.md,
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

  // ============= EMPTY STATES =============

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
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },

  emptyStateText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },

  // ============= LOADING STATES =============

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

  // ============= MODALS & SHEETS =============

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
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },

  modalContent: {
    padding: theme.spacing.md,
  },

  // ============= BOTTOM SHEET ITEM MODALS =============
  // Shared styles for pantry item modals (Consume, Restock, Waste)

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

  // ============= BADGES & CHIPS =============

  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
  },

  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.white,
  },

  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.chipBackground,
    marginRight: theme.spacing.sm,
  },

  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.chipText,
  },

  chipSelected: {
    backgroundColor: theme.colors.chipSelectedBackground,
  },

  chipTextSelected: {
    color: theme.colors.chipSelectedText,
  },

  // ============= DIVIDERS =============

  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
  },

  dividerVertical: {
    width: 1,
    backgroundColor: theme.colors.divider,
  },

  // ============= FAB =============

  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 4,
        blurRadius: 6,
        spreadDistance: 0,
        color: '#0000004D',
      },
    ],
  },

  // ============= UTILITY =============
  // Reusable shadow style
  shadow: shadowStyle,
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

  // ============= TYPOGRAPHY PRESETS =============

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
    textDecorationLine: 'underline',
  },
}));
