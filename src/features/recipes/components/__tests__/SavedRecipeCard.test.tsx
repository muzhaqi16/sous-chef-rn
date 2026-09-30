import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  createApolloTestWrapper,
  seedCache,
  toFragmentRef,
} from '#/test-utils/apolloMockProvider';
import { SavedRecipeCard } from '../SavedRecipeCard';
import { SavedRecipeCard_SavedRecipeFragmentDoc } from '../SavedRecipeCard.generated';

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: () => null,
}));

function renderCard(recipe: null | { name: string }) {
  const cache = seedCache([]);
  cache.writeFragment({
    fragment: SavedRecipeCard_SavedRecipeFragmentDoc,
    fragmentName: 'SavedRecipeCard_savedRecipe',
    data: {
      __typename: 'SavedRecipe',
      id: 'sr-1',
      recipeId: 'recipe-1',
      folder: null,
      tags: [],
      notes: null,
      personalRating: null,
      cookedCount: 0,
      lastCookedAt: null,
      recipe: recipe && {
        __typename: 'Recipe',
        id: 'recipe-1',
        name: recipe.name,
        description: null,
        imageUrl: null,
        servings: 4,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        totalTimeMinutes: 30,
      },
    },
  });
  const onPress = jest.fn();
  const onRemove = jest.fn();
  const Wrapper = createApolloTestWrapper({ cache });
  render(
    <Wrapper>
      <SavedRecipeCard
        savedRecipeRef={toFragmentRef<
          typeof SavedRecipeCard_SavedRecipeFragmentDoc
        >({ __typename: 'SavedRecipe', id: 'sr-1' })}
        onPress={onPress}
        onRemove={onRemove}
      />
    </Wrapper>,
  );
  return { onPress, onRemove };
}

describe('SavedRecipeCard', () => {
  it('shows the recipe it saved', () => {
    renderCard({ name: 'Lasagne' });

    expect(screen.getByText('Lasagne')).toBeTruthy();
    expect(screen.getByText(/4 servings/)).toBeTruthy();
  });

  it('keeps an unpublished recipe listed, as unavailable and removable', () => {
    const { onRemove } = renderCard(null);

    expect(screen.getByText('This item is no longer available')).toBeTruthy();
    expect(screen.queryByText(/servings/)).toBeNull();

    fireEvent.press(screen.getByLabelText('Remove from saved'));
    expect(onRemove).toHaveBeenCalledWith('recipe-1');
  });
});
