import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';

export const styles = StyleSheet.create(theme => ({
  gestureContainer: {
    overflow: 'visible', // Allow shadow to show and actions to extend
  },

  actionsContainer: {
    ...commonStyles.row,
    height: '100%',
    backgroundColor: theme.colors.charade['950'],
    justifyContent: 'center',
    alignItems: 'center',
    width: 160,
    marginLeft: -12, // Extend under card edge to cover rounded corners
    paddingLeft: 12, // Compensate for margin to maintain button positioning
    borderTopLeftRadius: 0, // Square edge where it meets the card
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 12, // Rounded outer edge
    borderBottomRightRadius: 12,
  },
  leftActionsContainer: {
    ...commonStyles.row,
    height: '100%',
    backgroundColor: theme.colors.charade['950'],
    justifyContent: 'center',
    alignItems: 'center',
    width: 180,
    gap: theme.spacing.xs,
    marginRight: -12, // Extend under card edge to cover rounded corners
    paddingRight: 12, // Compensate for margin to maintain button positioning
    borderTopRightRadius: 0, // Square edge where it meets the card
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 12, // Rounded outer edge
    borderBottomLeftRadius: 12,
  },

  actionButton: {
    width: 50,
    ...commonStyles.center,
    height: '100%',
    zIndex: 100, // Ensure button is above other elements for touch priority
  },

  circularActionButton: {
    width: 40,
    height: 40,
    borderRadius: 28,
    ...commonStyles.center,
    marginHorizontal: 4,
    zIndex: 100, // Ensure button is above other elements for touch priority
    borderWidth: 1.5,
    borderColor: theme.colors.white, // Subtle white border
    backgroundColor: 'transparent', // No fill - outlined style
  },

  editButton: {
    backgroundColor: theme.colors.success,
  },

  deleteButton: {
    backgroundColor: theme.colors.error,
  },

  deleteText: {
    color: theme.colors.white,
    fontSize: 12,
    marginTop: theme.spacing.xs,
    fontWeight: '600',
  },
}));
