'use no memo';
import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { usePantrySelectorConfig } from '../usePantrySelectorConfig';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));

describe('usePantrySelectorConfig', () => {
  const defaultOptions = {
    pantries: [
      { id: 'p1', name: 'Kitchen' },
      { id: 'p2', name: 'Garage' },
    ],
    selectedPantryId: 'p1',
    loading: false,
    setSelectedPantryId: jest.fn(),
    selectorRef: {
      current: {
        open: jest.fn(),
        close: jest.fn(),
        isActive: jest.fn(),
        toggle: jest.fn(),
      },
    },
    toPantrySettings: jest.fn(),
    toPantryAnalytics: jest.fn(),
  };

  it('returns config with correct title', () => {
    const { result } = renderHook(() =>
      usePantrySelectorConfig(defaultOptions),
    );
    expect(result.current.title).toBe('Select Pantry');
  });

  it('returns data from pantries', () => {
    const { result } = renderHook(() =>
      usePantrySelectorConfig(defaultOptions),
    );
    expect(result.current.data).toEqual(defaultOptions.pantries);
  });

  it('returns three action buttons', () => {
    const { result } = renderHook(() =>
      usePantrySelectorConfig(defaultOptions),
    );
    expect(result.current.actions).toHaveLength(3);
    expect(result.current.actions[0].label).toBe('Create New Pantry');
    expect(result.current.actions[1].label).toBe('Edit Selected Pantry');
    expect(result.current.actions[2].label).toBe('View Analytics');
  });

  it('disables edit/analytics when no pantry selected', () => {
    const { result } = renderHook(() =>
      usePantrySelectorConfig({
        ...defaultOptions,
        selectedPantryId: undefined,
      }),
    );
    expect(result.current.actions[1].disabled).toBe(true);
    expect(result.current.actions[2].disabled).toBe(true);
  });
});
