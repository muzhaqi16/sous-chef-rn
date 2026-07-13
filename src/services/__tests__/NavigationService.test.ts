jest.mock('@react-navigation/native', () => {
  const ref = {
    current: null,
    isReady: jest.fn(),
    dispatch: jest.fn(),
    canGoBack: jest.fn(),
    goBack: jest.fn(),
  };
  return {
    createNavigationContainerRef: () => ref,
    CommonActions: {
      navigate: jest.fn((...args: unknown[]) => ({
        type: 'NAVIGATE',
        payload: args,
      })),
      reset: jest.fn((...args: unknown[]) => ({
        type: 'RESET',
        payload: args,
      })),
      goBack: jest.fn(() => ({ type: 'GO_BACK' })),
      preload: jest.fn((...args: unknown[]) => ({
        type: 'PRELOAD',
        payload: args,
      })),
    },
    StackActions: {
      push: jest.fn((...args: unknown[]) => ({ type: 'PUSH', payload: args })),
      replace: jest.fn((...args: unknown[]) => ({
        type: 'REPLACE',
        payload: args,
      })),
      popToTop: jest.fn(() => ({ type: 'POP_TO_TOP' })),
    },
    useNavigation: jest.fn(),
    useRoute: jest.fn(),
    useFocusEffect: jest.fn(),
    useIsFocused: jest.fn(),
    NavigationContainer: ({ children }: { children: ReactNode }) => children,
  };
});

import type { ReactNode } from 'react';
import { CommonActions, StackActions } from '@react-navigation/native';
import NavigationService, { navigationRef } from '../NavigationService';

describe('NavigationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Drain any navigation the previous test left in the pending slot
    // (isReady is a cleared mock returning undefined, so this never dispatches).
    NavigationService.flushPendingNavigation();
    jest.clearAllMocks();
  });

  describe('navigate', () => {
    it('dispatches navigate action when ready', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(true);
      NavigationService.navigate('Home', { id: '1' });
      expect(CommonActions.navigate).toHaveBeenCalledWith('Home', { id: '1' });
      expect(navigationRef.dispatch).toHaveBeenCalled();
    });

    it('does not dispatch when not ready', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(false);
      NavigationService.navigate('Home');
      expect(navigationRef.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('pending navigation / flushPendingNavigation', () => {
    it('queues a not-ready navigate and dispatches it once on flush', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(false);
      NavigationService.navigate('Notifications', { category: 'PANTRY' });
      expect(navigationRef.dispatch).not.toHaveBeenCalled();

      (navigationRef.isReady as jest.Mock).mockReturnValue(true);
      NavigationService.flushPendingNavigation();
      expect(CommonActions.navigate).toHaveBeenCalledWith('Notifications', {
        category: 'PANTRY',
      });
      expect(navigationRef.dispatch).toHaveBeenCalledTimes(1);

      // Slot is consumed — a second flush dispatches nothing
      NavigationService.flushPendingNavigation();
      expect(navigationRef.dispatch).toHaveBeenCalledTimes(1);
    });

    it('keeps only the latest pre-ready navigation (last wins)', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(false);
      NavigationService.navigate('Pantry');
      NavigationService.navigate('ShoppingList', { listId: 'l-2' });

      (navigationRef.isReady as jest.Mock).mockReturnValue(true);
      NavigationService.flushPendingNavigation();
      expect(navigationRef.dispatch).toHaveBeenCalledTimes(1);
      expect(CommonActions.navigate).toHaveBeenCalledWith('ShoppingList', {
        listId: 'l-2',
      });
    });

    it('flush with an empty slot is a no-op', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(true);
      NavigationService.flushPendingNavigation();
      expect(navigationRef.dispatch).not.toHaveBeenCalled();
    });

    it('ready-state navigate does not populate the slot', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(true);
      NavigationService.navigate('Home');
      expect(navigationRef.dispatch).toHaveBeenCalledTimes(1);

      NavigationService.flushPendingNavigation();
      expect(navigationRef.dispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('goBack', () => {
    it('goes back when ready and can go back', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(true);
      (navigationRef.canGoBack as jest.Mock).mockReturnValue(true);
      NavigationService.goBack();
      expect(navigationRef.goBack).toHaveBeenCalled();
    });

    it('does nothing when cannot go back', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(true);
      (navigationRef.canGoBack as jest.Mock).mockReturnValue(false);
      NavigationService.goBack();
      expect(navigationRef.goBack).not.toHaveBeenCalled();
    });

    it('does nothing when not ready', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(false);
      NavigationService.goBack();
      expect(navigationRef.goBack).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('dispatches reset action', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(true);
      NavigationService.reset([{ name: 'Login' }]);
      expect(CommonActions.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Login' }],
      });
      expect(navigationRef.dispatch).toHaveBeenCalled();
    });

    it('does nothing when not ready', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(false);
      NavigationService.reset([{ name: 'Login' }]);
      expect(navigationRef.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('push', () => {
    it('dispatches push action', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(true);
      NavigationService.push('Detail', { id: '1' });
      expect(StackActions.push).toHaveBeenCalledWith('Detail', { id: '1' });
      expect(navigationRef.dispatch).toHaveBeenCalled();
    });
  });

  describe('replace', () => {
    it('dispatches replace action', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(true);
      NavigationService.replace('Home');
      expect(StackActions.replace).toHaveBeenCalledWith('Home', undefined);
      expect(navigationRef.dispatch).toHaveBeenCalled();
    });
  });

  describe('popToTop', () => {
    it('dispatches popToTop action', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(true);
      NavigationService.popToTop();
      expect(StackActions.popToTop).toHaveBeenCalled();
      expect(navigationRef.dispatch).toHaveBeenCalled();
    });
  });

  describe('preload', () => {
    it('dispatches preload action', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(true);
      NavigationService.preload('Settings');
      expect(CommonActions.preload).toHaveBeenCalledWith('Settings');
      expect(navigationRef.dispatch).toHaveBeenCalled();
    });
  });
});
