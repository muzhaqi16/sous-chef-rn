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
import {
  useOpenCatalogRecipe,
  type CatalogRecipeHint,
  type OpenedCatalogRecipe,
} from '../useOpenCatalogRecipe';

const HINT: CatalogRecipeHint = {
  externalId: '716429',
  name: 'Pasta with Garlic',
  imageUrl: 'https://img.spoonacular.com/recipes/716429-556x370.jpg',
};

const openedMock = () =>
  recordMock(OpenCatalogRecipeDocument, {
    data: {
      upsertExternalRecipe: {
        __typename: 'UpsertExternalRecipePayload',
        recipe: { __typename: 'Recipe', id: 'recipe-1' },
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
      },
    ]);
    expect(opened).toEqual({ opened: true, recipeId: 'recipe-1' });
  });

  // The API refuses an image off Spoonacular's own host, and one refused hint
  // fails the whole open.
  it.each([
    ['another host', 'https://cdn.example.com/pasta.jpg'],
    ['plain http', 'http://img.spoonacular.com/recipes/716429.jpg'],
    ['a look-alike host', 'https://spoonacular.com.example.net/p.jpg'],
  ])('leaves out an image on %s', async (_case, imageUrl) => {
    const m = openedMock();

    await open({ ...HINT, imageUrl }, [m.mock]);

    expect(m.fired[0]).toEqual({
      input: expect.objectContaining({ externalId: '716429' }),
    });
    expect(
      (m.fired[0]?.input as { imageUrl?: string } | undefined)?.imageUrl,
    ).toBeUndefined();
  });

  it('keeps an image on Spoonacular’s own host', async () => {
    const m = openedMock();

    await open(
      { ...HINT, imageUrl: 'https://spoonacular.com/recipeImages/716429.jpg' },
      [m.mock],
    );

    expect(m.fired[0]).toEqual({
      input: expect.objectContaining({
        imageUrl: 'https://spoonacular.com/recipeImages/716429.jpg',
      }),
    });
  });

  it('reads a removed recipe as not found', async () => {
    const m = recordMock(OpenCatalogRecipeDocument, {
      data: {
        upsertExternalRecipe: { __typename: 'NotFoundError', message: 'gone' },
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
