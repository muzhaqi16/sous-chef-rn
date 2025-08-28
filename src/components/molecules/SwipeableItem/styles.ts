import {StyleSheet} from 'react-native-unistyles';

export const styles = StyleSheet.create(theme => ({
  gestureContainer: {
    marginBottom: 8,
  },
  container: {
    overflow: 'hidden',
  },
  itemContainer: {
    backgroundColor: 'white',
  },
  actionsContainer: {
    flexDirection: 'row',
    height: '100%',
  },
  actionButton: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  editButton: {
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  leftActionContainer: {
    flex: 1,
    backgroundColor: '#F44336',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  deleteIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    height: '100%',
  },
  deleteText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
}));
