import { StyleSheet } from 'react-native-unistyles';

/**
 * Shared by the screen and its sections, so a row in one looks like a row in
 * the next — splitting the sheet per section is how that stops being true.
 */
export const listSettingsStyles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
  },
  actionText: {
    flex: 1,
    marginLeft: theme.spacing.base,
  },
  sharedInfo: {
    marginTop: theme.spacing.sm,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.base,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.error,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
  },
  deleteButtonText: {
    marginLeft: theme.spacing.sm,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.smPlus,
    backgroundColor: theme.colors.surface,
  },
  pickerButtonDisabled: {
    opacity: 0.6,
  },
  fieldNote: {
    marginTop: theme.spacing.sm,
  },
  leaveDescription: {
    marginTop: theme.spacing.sm,
  },
  disabledLeaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.base,
    borderWidth: theme.borderWidth.hairline,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    borderColor: theme.colors.border,
    opacity: 0.6,
  },
  disabledButtonText: {
    marginLeft: theme.spacing.sm,
  },
}));
