'use no memo';

import { renderHook } from '@testing-library/react-native';

// Mock the deep dependency chain that causes import errors
jest.mock('@gorhom/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  return {
    __esModule: true,
    default: R.forwardRef((props: unknown, ref: unknown) => {
      R.useImperativeHandle(ref, () => ({
        snapToIndex: jest.fn(),
        expand: jest.fn(),
        collapse: jest.fn(),
        close: jest.fn(),
        forceClose: jest.fn(),
      }));
      return R.createElement(RN.View, props);
    }),
    BottomSheetModal: R.forwardRef((props: unknown, ref: unknown) => {
      R.useImperativeHandle(ref, () => ({
        present: jest.fn(),
        dismiss: jest.fn(),
        snapToIndex: jest.fn(),
        expand: jest.fn(),
        collapse: jest.fn(),
        close: jest.fn(),
        forceClose: jest.fn(),
      }));
      return R.createElement(RN.View, props);
    }),
    BottomSheetModalProvider: ({ children }: { children: unknown }) => children,
    BottomSheetBackdrop: (props: unknown) => R.createElement(RN.View, props),
    BottomSheetView: (props: unknown) => R.createElement(RN.View, props),
    BottomSheetScrollView: (props: unknown) => R.createElement(RN.View, props),
    BottomSheetFlatList: (props: unknown) => R.createElement(RN.View, props),
    BottomSheetTextInput: (props: unknown) =>
      R.createElement(RN.TextInput, props),
    BottomSheetFooter: (props: unknown) => R.createElement(RN.View, props),
    BottomSheetHandle: (props: unknown) => R.createElement(RN.View, props),
    SCROLLABLE_TYPE: { SCROLLVIEW: 'SCROLLVIEW', FLATLIST: 'FLATLIST' },
    createBottomSheetScrollableComponent: jest.fn(
      (_type: unknown, component: unknown) => component,
    ),
    useBottomSheet: jest.fn(() => ({
      snapToIndex: jest.fn(),
      expand: jest.fn(),
      collapse: jest.fn(),
      close: jest.fn(),
    })),
    useBottomSheetModal: jest.fn(() => ({
      dismiss: jest.fn(),
      dismissAll: jest.fn(),
    })),
    useBottomSheetDynamicSnapPoints: jest.fn(() => ({
      animatedHandleHeight: { value: 0 },
      animatedSnapPoints: { value: [0] },
      animatedContentHeight: { value: 0 },
      handleContentLayout: jest.fn(),
    })),
  };
});

import { useShoppingListModals } from '../ShoppingListModalsContext';

describe('ShoppingListModalsContext', () => {
  describe('useShoppingListModals', () => {
    it('throws when used outside provider', () => {
      expect(() => {
        renderHook(() => useShoppingListModals());
      }).toThrow(
        'useShoppingListModals must be used within ShoppingListModalsProvider',
      );
    });
  });
});
