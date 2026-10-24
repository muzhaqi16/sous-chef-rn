import React from 'react';
import { render } from '@testing-library/react-native';
import { RecipeSearchInput } from '../RecipeSearchInput';

type SearchBarProps = {
  maxLength?: number;
  accessory?: unknown;
  onSubmitEditing?: () => void;
};
const mockSearchBar = jest.fn<null, [SearchBarProps]>(() => null);
jest.mock('#components/molecules/SearchBar', () => ({
  SearchBar: (props: SearchBarProps) => mockSearchBar(props),
}));

describe('RecipeSearchInput', () => {
  it('stops at the longest query the API takes', () => {
    render(
      <RecipeSearchInput
        onSearch={jest.fn()}
        initialQuery=""
        onClear={jest.fn()}
      />,
    );

    expect(mockSearchBar).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxLength: 200 }),
    );
  });

  // The keyboard's Search key runs it; nothing beside the field repeats that.
  it('searches from the keyboard with no submit button beside the field', () => {
    const onSearch = jest.fn();
    render(
      <RecipeSearchInput
        onSearch={onSearch}
        initialQuery="eggs"
        onClear={jest.fn()}
      />,
    );

    const props = mockSearchBar.mock.lastCall?.[0];
    expect(props?.accessory).toBeUndefined();
    props?.onSubmitEditing?.();
    expect(onSearch).toHaveBeenCalledWith('eggs');
  });
});
