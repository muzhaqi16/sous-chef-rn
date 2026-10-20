import { act } from '@testing-library/react-native';
import { GraphQLError } from 'graphql';
import {
  ExternalSource,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
  type MockFor,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { OpenCatalogRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import {
  catalogHintOf,
  useOpenCatalogRecipe,
  type CatalogRecipeHint,
  type OpenedCatalogRecipe,
} from '../useOpenCatalogRecipe';

const HINT: CatalogRecipeHint = {
  provider: ExternalSource.Spoonacular,
  externalId: '716429',
  name: 'Pasta with Garlic',
  imageUrl: 'https://img.spoonacular.com/recipes/716429-556x370.jpg',
};

const openedMock = () =>
  recordMock(OpenCatalogRecipeDocument, {
    data: {
      upsertExternalRecipe: {
        __typename: 'UpsertExternalRecipePayload',
        recipe: { id: 'recipe-1' },
      },
    },
  });

async function open(
  hint: CatalogRecipeHint,
  operationMocks: MockedResponse[],
): Promise<OpenedCatalogRecipe> {
  const { result } = renderHookWithApollo(() => useOpenCatalogRecipe(), {
    operationMocks,
  });
  let opened: OpenedCatalogRecipe | undefined;
  await act(async () => {
    opened = await result.current.openCatalogRecipe(hint);
  });
  if (!opened) throw new Error('openCatalogRecipe did not settle');
  return opened;
}

describe('useOpenCatalogRecipe', () => {
  it('names the recipe by provider and id, with the row hints', async () => {
    const m = openedMock();

    const opened = await open(HINT, [m.mock]);

    expect(m.fired).toEqual([
      {
        input: {
          source: ExternalSource.Spoonacular,
          externalId: '716429',
          name: 'Pasta with Garlic',
          imageUrl: HINT.imageUrl,
        },
        // The answer is what the detail screen reads, at the largest page.
        ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
      },
    ]);
    expect(opened).toEqual({ opened: true, recipeId: 'recipe-1' });
  });

  // The hit came from the API, so its image is already on the provider's host.
  it('sends the image hint as the hit gave it', async () => {
    const m = openedMock();

    await open({ ...HINT, imageUrl: 'https://cdn.example.com/pasta.jpg' }, [
      m.mock,
    ]);

    expect(m.fired[0]).toMatchObject({
      input: { imageUrl: 'https://cdn.example.com/pasta.jpg' },
    });
  });

  it('sends a hint without an image without one', async () => {
    const m = openedMock();

    await open({ ...HINT, imageUrl: undefined }, [m.mock]);

    expect(
      (m.fired[0]?.input as { imageUrl?: string } | undefined)?.imageUrl,
    ).toBeUndefined();
  });

  // The API refuses a name over 200 characters, which would fail the open.
  it('cuts a name longer than the API takes', async () => {
    const m = openedMock();

    await open({ ...HINT, name: 'a'.repeat(250) }, [m.mock]);

    expect(m.fired[0]).toMatchObject({ input: { name: 'a'.repeat(200) } });
  });

  it('reads a removed recipe as not found', async () => {
    const m = recordMock(OpenCatalogRecipeDocument, {
      data: {
        upsertExternalRecipe: { __typename: 'NotFoundError' },
      },
    });

    const opened = await open(HINT, [m.mock]);

    expect(opened).toEqual({ opened: false, failure: 'Recipe not found' });
  });

  it('says why when the day’s new-recipe allowance is spent', async () => {
    const limited: MockFor<typeof OpenCatalogRecipeDocument> = {
      request: { query: OpenCatalogRecipeDocument, variables: () => true },
      result: {
        errors: [
          new GraphQLError('Too many new recipes today', {
            extensions: {
              code: TopLevelErrorCode.RateLimitExceeded,
              retryAfter: 3600,
            },
          }),
        ],
      },
    };

    const opened = await open(HINT, [limited]);

    expect(opened).toEqual({
      opened: false,
      failure:
        "You've opened a lot of new recipes today. Try this one tomorrow; recipes you've opened before still open.",
    });
  });

  it('fails in the app’s own words when the API cannot be reached', async () => {
    const unreachable: MockFor<typeof OpenCatalogRecipeDocument> = {
      request: { query: OpenCatalogRecipeDocument, variables: () => true },
      error: new Error('network down'),
    };

    const opened = await open(HINT, [unreachable]);

    expect(opened.opened).toBe(false);
    expect(opened).not.toEqual(
      expect.objectContaining({
        failure: expect.stringContaining('network down'),
      }),
    );
  });
});

describe('catalogHintOf', () => {
  it('names a hit by its provider and the provider’s id', () => {
    expect(
      catalogHintOf({
        provider: ExternalSource.Spoonacular,
        providerRecipeId: '716429',
        name: 'Pasta with Garlic',
        imageUrl: 'https://img.spoonacular.com/recipes/716429-556x370.jpg',
      }),
    ).toEqual(HINT);
  });

  it('carries no image for a hit without one', () => {
    expect(
      catalogHintOf({
        provider: ExternalSource.Spoonacular,
        providerRecipeId: '716429',
        name: 'Pasta with Garlic',
        imageUrl: null,
      }),
    ).toEqual({ ...HINT, imageUrl: undefined });
  });
});
