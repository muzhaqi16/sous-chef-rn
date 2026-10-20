import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import { useRecipeSuggestionsForItem } from '../useRecipeSuggestionsForItem';
import { CatalogRecipesForItemDocument } from '../useRecipeSuggestionsForItem.generated';

type Edge = NonNullable<
  NonNullable<
    MockDataFor<
      typeof CatalogRecipesForItemDocument
    >['catalogRecipesByIngredients']
  >['edges']
>[number];

const edge = (id: string, name: string): Edge => ({
  node: { provider: ExternalSource.Spoonacular, providerRecipeId: id, name },
});

const suggestionsMock = (edges: Edge[]) =>
  recordMock(CatalogRecipesForItemDocument, {
    data: { catalogRecipesByIngredients: { edges } },
  });

const renderSuggestions = (
  itemName: string | undefined,
  operationMocks: MockedResponse[],
) =>
  renderHookWithApollo(() => useRecipeSuggestionsForItem(itemName), {
    operationMocks,
  });

describe('useRecipeSuggestionsForItem', () => {
  it('lists catalog recipes that use the item, five at most', async () => {
    const suggestions = suggestionsMock([
      edge('1', 'Tomato soup'),
      edge('2', 'Bruschetta'),
    ]);
    const { result } = renderSuggestions('tomatoes', [suggestions.mock]);

    await waitFor(() =>
      expect(result.current.suggestedRecipes).toHaveLength(2),
    );

    expect(suggestions.fired).toEqual([
      { ingredients: ['tomatoes'], first: 5 },
    ]);
    expect(result.current.suggestedRecipes.map(r => r.name)).toEqual([
      'Tomato soup',
      'Bruschetta',
    ]);
    expect(result.current.loadingRecipes).toBe(false);
  });

  it('asks for nothing, and suggests nothing, without an item name', () => {
    const suggestions = suggestionsMock([edge('1', 'Tomato soup')]);
    const { result } = renderSuggestions(undefined, [suggestions.mock]);

    expect(suggestions.fired).toEqual([]);
    expect(result.current.suggestedRecipes).toEqual([]);
    expect(result.current.loadingRecipes).toBe(false);
  });

  it('is loading only until the API answers', async () => {
    const suggestions = recordMock(CatalogRecipesForItemDocument, {
      data: { catalogRecipesByIngredients: { edges: [edge('1', 'Soup')] } },
      held: true,
    });
    const { result } = renderSuggestions('tomatoes', [suggestions.mock]);

    expect(result.current.loadingRecipes).toBe(true);

    suggestions.release();
    await waitFor(() => expect(result.current.loadingRecipes).toBe(false));
    expect(result.current.suggestedRecipes).toHaveLength(1);
  });

  it('suggests nothing when the API cannot answer', async () => {
    const suggestions = recordMock(CatalogRecipesForItemDocument, {
      error: new Error('network down'),
    });
    const { result } = renderSuggestions('tomatoes', [suggestions.mock]);

    await waitFor(() => expect(suggestions.fired).toHaveLength(1));
    await waitFor(() => expect(result.current.loadingRecipes).toBe(false));
    expect(result.current.suggestedRecipes).toEqual([]);
  });
});
