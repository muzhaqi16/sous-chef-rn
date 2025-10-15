import {StyleSheet} from 'react-native-unistyles';
import {commonStyles} from '#/styles/commonStyles';

export const styles = StyleSheet.create(theme => ({
  gestureContainer: {
    marginBottom: 12, // Space for shadow and card separation
    overflow: 'visible', // Allow shadow to show
  },

  container: {
    borderRadius: 12, // Match card radius
    overflow: 'hidden', // Prevent actions from going off screen
  },

  actionsContainer: {
    ...commonStyles.row,
    height: '100%',
    backgroundColor: '#2C2B3B', // Correct background color from prototype
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
    backgroundColor: '#2C2B3B', // Correct background color from prototype
    justifyContent: 'center',
    alignItems: 'center',
    width: 120, // Fixed width for consistent spacing
    borderTopRightRadius: 0, // Square connection to card
    borderBottomRightRadius: 0, // Square connection to card
    borderTopLeftRadius: 12, // Round the outer edge
    borderBottomLeftRadius: 12, // Round the outer edge
  },

  actionButton: {
    width: 60,
    ...commonStyles.center,
    height: '100%',
  },

  circularActionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6C757D', // Gray circle background
    ...commonStyles.center,
    marginHorizontal: 8,
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
