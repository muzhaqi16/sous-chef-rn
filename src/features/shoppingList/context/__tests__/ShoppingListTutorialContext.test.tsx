import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import {
  ShoppingListTutorialProvider,
  useShoppingListTutorialActions,
} from '../ShoppingListTutorialContext';

jest.mock('#/storage/mmkv');

const { __mockStore: mockStore } = jest.requireMock<{
  __mockStore: Map<string, boolean | string | number | ArrayBuffer>;
}>('#/storage/mmkv');

jest.mock('#hooks/settings/useSettings', () => ({
  useShowTutorials: () => true,
}));

jest.mock('#store/useAppStore', () => ({
  useUserId: () => 'user-1',
}));

jest.mock('#hooks/ui/useTutorialResetSignal', () => ({
  useTutorialResetSignal: () => false,
}));

const mockMarkSeen = jest.fn();
jest.mock('#hooks/ui/markTutorialsSeen', () => ({
  markTutorialsSeen: () => mockMarkSeen(),
}));

beforeEach(() => {
  mockStore.clear();
  mockMarkSeen.mockClear();
});

describe('ShoppingListTutorialProvider — account-level completion', () => {
  it('records completion when the interactive tutorial is dismissed', () => {
    const { result } = renderHook(() => useShoppingListTutorialActions(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <ShoppingListTutorialProvider canStart={false}>
          {children}
        </ShoppingListTutorialProvider>
      ),
    });

    act(() => {
      result.current?.skipAll();
    });

    expect(
      mockStore.get('feature_hint_shown_user-1_shopping_interactive_tutorial'),
    ).toBe(true);
    expect(mockMarkSeen).toHaveBeenCalledTimes(1);
  });
});
