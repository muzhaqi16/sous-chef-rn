import React from 'react';
import { render } from '@testing-library/react-native';
import { RecipeSearchInput } from '../RecipeSearchInput';

const mockSearchBar = jest.fn<null, [{ maxLength?: number }]>(() => null);
jest.mock('#components/molecules/SearchBar', () => ({
  SearchBar: (props: { maxLength?: number }) => mockSearchBar(props),
}));

describe('RecipeSearchInput', () => {
  it('stops at the longest query the API takes', () => {
    render(
      <RecipeSearchInput
        onSearch={jest.fn()}
        extraActions={[]}
        initialQuery=""
        onClear={jest.fn()}
      />,
    );

    expect(mockSearchBar).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxLength: 200 }),
    );
  });
});
