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
    width: 160, // Fixed width for consistent spacing
    borderTopLeftRadius: 0, // Square connection to card
    borderBottomLeftRadius: 0, // Square connection to card
    borderTopRightRadius: 12, // Round the outer edge
    borderBottomRightRadius: 12, // Round the outer edge
  },
  leftActionsContainer: {
    ...commonStyles.row,
    height: '100%',
    backgroundColor: theme.colors.charade['950'],
    justifyContent: 'center',
    alignItems: 'center',
    width: 180, // Fixed width for two buttons (consume + waste)
    gap: theme.spacing.sm, // Space between buttons
    borderTopRightRadius: 0, // Square connection to card
    borderBottomRightRadius: 0, // Square connection to card
    borderTopLeftRadius: 12, // Round the outer edge
    borderBottomLeftRadius: 12, // Round the outer edge
  },

  actionButton: {
    width: 60,
    ...commonStyles.center,
    height: '100%',
    zIndex: 100, // Ensure button is above other elements for touch priority
  },

  circularActionButton: {
    width: 50,
    height: 50,
    borderRadius: 28,
    ...commonStyles.center,
    marginHorizontal: 8,
    zIndex: 100, // Ensure button is above other elements for touch priority
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
