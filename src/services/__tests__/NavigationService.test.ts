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
      navigate: jest.fn((...args: any[]) => ({
        type: 'NAVIGATE',
        payload: args,
      })),
      reset: jest.fn((...args: any[]) => ({ type: 'RESET', payload: args })),
      goBack: jest.fn(() => ({ type: 'GO_BACK' })),
      preload: jest.fn((...args: any[]) => ({
        type: 'PRELOAD',
        payload: args,
      })),
    },
    StackActions: {
      push: jest.fn((...args: any[]) => ({ type: 'PUSH', payload: args })),
      replace: jest.fn((...args: any[]) => ({
        type: 'REPLACE',
        payload: args,
      })),
      popToTop: jest.fn(() => ({ type: 'POP_TO_TOP' })),
    },
    useNavigation: jest.fn(),
    useRoute: jest.fn(),
    useFocusEffect: jest.fn(),
    useIsFocused: jest.fn(),
    NavigationContainer: ({ children }: any) => children,
  };
});

import { CommonActions, StackActions } from '@react-navigation/native';
import NavigationService, { navigationRef } from '../NavigationService';

describe('NavigationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('navigate', () => {
    it('dispatches navigate action when ready', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(true);
      NavigationService.navigate('Home', { id: '1' });
      expect(CommonActions.navigate).toHaveBeenCalledWith('Home', { id: '1' });
      expect(navigationRef.dispatch).toHaveBeenCalled();
    });

    it('does nothing when not ready', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(false);
      NavigationService.navigate('Home');
      expect(navigationRef.dispatch).not.toHaveBeenCalled();
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
