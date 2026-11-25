import React, { createRef } from 'react';
import { render } from '@testing-library/react-native';
import { SearchBar, type SearchBarRef } from '../SearchBar';

let lastProps: Record<string, unknown> = {};

jest.mock('#components/molecules/BaseInput/BaseInput', () => ({
  BaseInput: (props: Record<string, unknown>) => {
    lastProps = props;
    return null;
  },
}));

/**
 * One ref reaches the input, inside a sheet or out. A debounced SearchBar is
 * uncontrolled, so a handle that missed it could not change what is shown.
 */
describe('SearchBar debounced mode, imperative handle', () => {
  beforeEach(() => {
    lastProps = {};
  });

  it('hands the input one ref', () => {
    render(<SearchBar onChangeText={jest.fn()} debounceMs={250} />);
    expect(lastProps.ref).toBeTruthy();
    expect(lastProps).not.toHaveProperty('sheetRef');
  });

  it('reaches the input through it', () => {
    const searchRef = createRef<SearchBarRef>();
    const onChangeText = jest.fn();
    render(
      <SearchBar
        ref={searchRef}
        onChangeText={onChangeText}
        debounceMs={250}
      />,
    );

    const clear = jest.fn();
    const focus = jest.fn();
    const plainRef = lastProps.ref as React.RefObject<unknown>;
    plainRef.current = { clear, focus, setNativeProps: jest.fn() };

    searchRef.current?.focus();
    expect(focus).toHaveBeenCalledTimes(1);

    searchRef.current?.clear();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('hands it the ref in controlled mode too', () => {
    render(<SearchBar onChangeText={jest.fn()} value="milk" />);
    expect(lastProps.ref).toBeTruthy();
  });
});
