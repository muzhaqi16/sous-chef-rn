import React from 'react';
import { View } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet, UnistyleDependency } from 'react-native-unistyles';
import { ThemeEpochSentinel } from '../ThemeEpochSentinel';

describe('ThemeEpochSentinel', () => {
  it('remounts its view on every theme commit, and only then', () => {
    render(<ThemeEpochSentinel />);
    const [registration] = jest.mocked(StyleSheet.addChangeListener).mock.calls;
    if (!registration)
      throw new Error('ThemeEpochSentinel read no theme epoch');
    const [emitChange] = registration;
    const first = screen.UNSAFE_getByType(View);

    act(() => emitChange([UnistyleDependency.Ime]));
    expect(screen.UNSAFE_getByType(View)).toBe(first);

    act(() => emitChange([UnistyleDependency.Theme]));
    expect(screen.UNSAFE_getByType(View)).not.toBe(first);
  });
});
