import { act, renderHook } from '@testing-library/react-native';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import {
  recordOpenedCatalogRecipe,
  useOpenedCatalogRecipesStore,
  useOpenedRecipeId,
} from '../openedCatalogRecipes';

const HIT = { provider: ExternalSource.Spoonacular, externalId: '716429' };

describe('openedCatalogRecipes', () => {
  beforeEach(() => {
    useOpenedCatalogRecipesStore.setState({ recipeIds: {} });
  });

  it('finds the recipe a catalog row opened', () => {
    const { result } = renderHook(() => useOpenedRecipeId(HIT));
    expect(result.current).toBeUndefined();

    act(() => recordOpenedCatalogRecipe(HIT, 'r1'));

    expect(result.current).toBe('r1');
  });

  it('keeps two providers with the same id apart', () => {
    recordOpenedCatalogRecipe(HIT, 'r1');

    const { result } = renderHook(() =>
      useOpenedRecipeId({ ...HIT, provider: ExternalSource.Tasty }),
    );

    expect(result.current).toBeUndefined();
  });

  it('forgets the oldest past what it keeps, never the newest', () => {
    for (let at = 0; at < 505; at++) {
      recordOpenedCatalogRecipe({ ...HIT, externalId: String(at) }, `r${at}`);
    }

    const { recipeIds } = useOpenedCatalogRecipesStore.getState();
    expect(Object.keys(recipeIds)).toHaveLength(500);
    expect(Object.values(recipeIds)).toContain('r504');
    expect(Object.values(recipeIds)).not.toContain('r0');
  });
});
