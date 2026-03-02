import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { renderHook, act } from '@testing-library/react-native';
import {
  TabBarActionsProvider,
  useTabBarSetters,
  useTabBarState,
  useTabBarActions,
} from '../TabBarActionsContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TabBarActionsProvider>{children}</TabBarActionsProvider>
);

describe('TabBarActionsContext', () => {
  describe('TabBarActionsProvider', () => {
    it('renders children', () => {
      render(
        <TabBarActionsProvider>
          <Text>Tab Content</Text>
        </TabBarActionsProvider>,
      );
      expect(screen.getByText('Tab Content')).toBeTruthy();
    });
  });

  describe('useTabBarSetters', () => {
    it('throws when used outside provider', () => {
      expect(() => {
        renderHook(() => useTabBarSetters());
      }).toThrow(
        'useTabBarSetters must be used within a TabBarActionsProvider',
      );
    });

    it('returns setter functions', () => {
      const { result } = renderHook(() => useTabBarSetters(), { wrapper });
      expect(typeof result.current.setScannerProps).toBe('function');
      expect(typeof result.current.setAddProps).toBe('function');
      expect(typeof result.current.setActiveTab).toBe('function');
      expect(typeof result.current.setOverlayOpen).toBe('function');
    });
  });

  describe('useTabBarState', () => {
    it('throws when used outside provider', () => {
      expect(() => {
        renderHook(() => useTabBarState());
      }).toThrow(
        'useTabBarState must be used within a TabBarActionsProvider',
      );
    });

    it('returns default state', () => {
      const { result } = renderHook(() => useTabBarState(), { wrapper });
      expect(result.current.showScannerButton).toBe(false);
      expect(result.current.showAddButton).toBe(false);
      expect(result.current.activeTab).toBe('');
      expect(result.current.isOverlayOpen).toBe(false);
      expect(result.current.isAddButtonDisabled).toBe(false);
    });
  });

  describe('useTabBarActions (combined)', () => {
    it('combines setters and state', () => {
      const { result } = renderHook(() => useTabBarActions(), { wrapper });
      // Should have setters
      expect(typeof result.current.setScannerProps).toBe('function');
      expect(typeof result.current.setAddProps).toBe('function');
      // Should have state
      expect(result.current.activeTab).toBeDefined();
      expect(result.current.showScannerButton).toBeDefined();
    });
  });

  describe('setActiveTab', () => {
    it('updates activeTab state', () => {
      const { result } = renderHook(() => useTabBarActions(), { wrapper });

      act(() => {
        result.current.setActiveTab('ShoppingList');
      });

      expect(result.current.activeTab).toBe('ShoppingList');
    });

    it('shows add button on allowed tabs', () => {
      const { result } = renderHook(() => useTabBarActions(), { wrapper });

      act(() => {
        result.current.setActiveTab('Pantry');
      });
      expect(result.current.showAddButton).toBe(true);

      act(() => {
        result.current.setActiveTab('ShoppingList');
      });
      expect(result.current.showAddButton).toBe(true);

      act(() => {
        result.current.setActiveTab('Recipe');
      });
      expect(result.current.showAddButton).toBe(true);

      act(() => {
        result.current.setActiveTab('MealPlan');
      });
      expect(result.current.showAddButton).toBe(true);
    });

    it('hides add button on non-allowed tabs', () => {
      const { result } = renderHook(() => useTabBarActions(), { wrapper });

      act(() => {
        result.current.setActiveTab('Profile');
      });
      expect(result.current.showAddButton).toBe(false);
    });
  });

  describe('setScannerProps', () => {
    it('shows scanner button when enabled on allowed tab', () => {
      const { result } = renderHook(() => useTabBarActions(), { wrapper });
      const onScan = jest.fn();

      act(() => {
        result.current.setActiveTab('Pantry');
        result.current.setScannerProps(onScan, true);
      });

      expect(result.current.showScannerButton).toBe(true);
      expect(result.current.onScanPress).toBe(onScan);
    });

    it('hides scanner button on non-allowed tab', () => {
      const { result } = renderHook(() => useTabBarActions(), { wrapper });
      const onScan = jest.fn();

      act(() => {
        result.current.setActiveTab('Recipe');
        result.current.setScannerProps(onScan, true);
      });

      expect(result.current.showScannerButton).toBe(false);
    });
  });

  describe('setAddProps', () => {
    it('sets add handler and disabled state', () => {
      const { result } = renderHook(() => useTabBarActions(), { wrapper });
      const onAdd = jest.fn();

      act(() => {
        result.current.setActiveTab('ShoppingList');
        result.current.setAddProps(onAdd, true, 'No list selected');
      });

      expect(result.current.onAddPress).toBe(onAdd);
      expect(result.current.isAddButtonDisabled).toBe(true);
      expect(result.current.addButtonDisabledMessage).toBe('No list selected');
    });
  });

  describe('setOverlayOpen', () => {
    it('toggles overlay state', () => {
      const { result } = renderHook(() => useTabBarActions(), { wrapper });

      act(() => {
        result.current.setOverlayOpen(true);
      });
      expect(result.current.isOverlayOpen).toBe(true);

      act(() => {
        result.current.setOverlayOpen(false);
      });
      expect(result.current.isOverlayOpen).toBe(false);
    });
  });

  describe('addButtonConfig', () => {
    it('returns search icon for Recipe tab', () => {
      const { result } = renderHook(() => useTabBarActions(), { wrapper });

      act(() => {
        result.current.setActiveTab('Recipe');
      });

      expect(result.current.addButtonConfig).toEqual({
        icon: 'search',
        iconLibrary: 'Feather',
      });
    });

    it('returns add icon for default tabs', () => {
      const { result } = renderHook(() => useTabBarActions(), { wrapper });

      act(() => {
        result.current.setActiveTab('Pantry');
      });

      expect(result.current.addButtonConfig).toEqual({
        icon: 'add',
        iconLibrary: 'Ionicons',
      });
    });
  });
});
