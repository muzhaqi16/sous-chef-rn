import React, { useEffect } from 'react';
import { act, render } from '@testing-library/react-native';
import { StyleSheet, UnistyleDependency } from 'react-native-unistyles';
import { CurrentThemeScope } from '../CurrentThemeScope';

const onMount = jest.fn();

const Child = () => {
  useEffect(() => {
    onMount();
  }, []);
  return null;
};

describe('CurrentThemeScope', () => {
  it('remounts its children on every theme commit, and only then', () => {
    render(
      <CurrentThemeScope>
        <Child />
      </CurrentThemeScope>,
    );
    const [registration] = jest.mocked(StyleSheet.addChangeListener).mock.calls;
    if (!registration) throw new Error('CurrentThemeScope read no theme epoch');
    const [emitChange] = registration;
    expect(onMount).toHaveBeenCalledTimes(1);

    act(() => emitChange([UnistyleDependency.Ime]));
    expect(onMount).toHaveBeenCalledTimes(1);

    // New values under the same name: the mocked `rt.themeName` never moves.
    act(() => emitChange([UnistyleDependency.Theme]));
    expect(onMount).toHaveBeenCalledTimes(2);
  });
});
