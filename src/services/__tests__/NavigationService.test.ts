import { CommonActions } from '@react-navigation/native';
import { rootNavigate } from '#navigation/rootNavigate';
import NavigationService, { navigationRef } from '../NavigationService';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual<object>('@react-navigation/native'),
  createNavigationContainerRef: () => ({
    isReady: jest.fn(),
    dispatch: jest.fn(),
  }),
}));

const ready = (isReady: boolean) =>
  jest.mocked(navigationRef.isReady).mockReturnValue(isReady);
const dispatched = () => jest.mocked(navigationRef.dispatch);

describe('NavigationService', () => {
  beforeEach(() => {
    // Drain any action the previous test left in the pending slot.
    ready(false);
    NavigationService.flushPendingNavigation();
    jest.clearAllMocks();
  });

  it('builds a root navigate action with its params and options', () => {
    expect(
      rootNavigate(
        'Notifications',
        { screen: 'NotificationDetail', params: { id: 'n1' } },
        { pop: true },
      ),
    ).toEqual(
      CommonActions.navigate(
        'Notifications',
        { screen: 'NotificationDetail', params: { id: 'n1' } },
        { pop: true },
      ),
    );
  });

  it('dispatches at once when the container is ready', () => {
    ready(true);
    NavigationService.navigate('ChangesNotSaved');

    expect(dispatched()).toHaveBeenCalledWith(
      CommonActions.navigate('ChangesNotSaved', undefined, undefined),
    );
  });

  // A cold-launch push tap arrives before onReady.
  it('holds an action until the container is ready, then dispatches it once', () => {
    const action = rootNavigate('ChangesNotSaved');
    NavigationService.dispatch(action);
    expect(dispatched()).not.toHaveBeenCalled();

    ready(true);
    NavigationService.flushPendingNavigation();
    NavigationService.flushPendingNavigation();

    expect(dispatched()).toHaveBeenCalledTimes(1);
    expect(dispatched()).toHaveBeenCalledWith(action);
  });

  it('keeps only the latest action requested before ready', () => {
    NavigationService.navigate('ChangesNotSaved');
    const latest = rootNavigate(
      'Notifications',
      { screen: 'NotificationList' },
      { pop: true },
    );
    NavigationService.dispatch(latest);

    ready(true);
    NavigationService.flushPendingNavigation();

    expect(dispatched()).toHaveBeenCalledTimes(1);
    expect(dispatched()).toHaveBeenCalledWith(latest);
  });

  it('dispatches nothing on a flush with nothing held', () => {
    ready(true);
    NavigationService.flushPendingNavigation();

    expect(dispatched()).not.toHaveBeenCalled();
  });
});
