import {StyleSheet} from 'react-native-unistyles';

export default StyleSheet.create(theme => ({
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },

  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },

  segment: {
    flexGrow: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },

  segmentActive: {
    backgroundColor: theme.colors.primary,
  },

  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },

  segmentTextActive: {
    color: theme.colors.white,
  },

  dateInput: {
    justifyContent: 'flex-start',
  },

  dateText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.md,
  },

  quantityContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
  },
}));
