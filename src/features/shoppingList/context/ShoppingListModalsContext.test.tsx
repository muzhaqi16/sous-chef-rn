'use no memo';

import { renderHook } from '@testing-library/react-native';

// Mock the deep dependency chain that causes import errors
jest.mock('@gorhom/bottom-sheet', () => {
  const RN = require('react-native');
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

import {
  useShoppingListModalActions,
  useAnyShoppingListSheetVisible,
} from './ShoppingListModalsContext';

describe('ShoppingListModalsContext', () => {
  it('throws when the commands are read outside the provider', () => {
    expect(() => {
      renderHook(() => useShoppingListModalActions());
    }).toThrow('ShoppingListModalsContext is missing its provider');
  });

  // A component shared with screens that have no sheets reads this, so outside
  // the provider it answers "nothing is open" rather than throwing.
  it('reports no sheet open outside the provider', () => {
    const { result } = renderHook(() => useAnyShoppingListSheetVisible());
    expect(result.current).toBe(false);
  });
});
