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
 * `sheetRef` reaches the input only inside a bottom sheet; outside one
 * `BaseInput` renders the plain host and routes `ref` instead. A debounced
 * SearchBar is uncontrolled, so a handle that reaches neither cannot change
 * what the person sees.
 */
describe('SearchBar debounced mode, imperative handle', () => {
  beforeEach(() => {
    lastProps = {};
  });

  it('hands the input a ref for the plain host as well as the sheet host', () => {
    render(<SearchBar onChangeText={jest.fn()} debounceMs={250} />);
    expect(lastProps.sheetRef).toBeTruthy();
    expect(lastProps.ref).toBeTruthy();
  });

  it('reaches the input that the plain host populated', () => {
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

  it('leaves both refs off in controlled mode', () => {
    render(<SearchBar onChangeText={jest.fn()} value="milk" />);
    expect(lastProps.sheetRef).toBeUndefined();
    expect(lastProps.ref).toBeUndefined();
  });
});
