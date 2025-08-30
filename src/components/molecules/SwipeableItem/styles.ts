import {StyleSheet} from 'react-native-unistyles';
import {commonStyles} from '#/styles/commonStyles';

export const styles = StyleSheet.create(theme => ({
  gestureContainer: {
    marginBottom: theme.spacing.sm,
  },

  container: {
    overflow: 'hidden',
  },

  itemContainer: {
    ...commonStyles.surface,
  },

  actionsContainer: {
    ...commonStyles.row,
    height: '100%',
  },

  actionButton: {
    width: 60,
    ...commonStyles.center,
    height: '100%',
  },

  editButton: {
    backgroundColor: theme.colors.success,
  },

  deleteButton: {
    backgroundColor: theme.colors.error,
  },

  leftActionContainer: {
    ...commonStyles.flex1,
    backgroundColor: theme.colors.error,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },

  deleteIconContainer: {
    ...commonStyles.center,
    paddingHorizontal: theme.spacing.lg,
    height: '100%',
  },

  deleteText: {
    color: theme.colors.white,
    fontSize: 12,
    marginTop: theme.spacing.xs,
    fontWeight: '600',
  },
}));
