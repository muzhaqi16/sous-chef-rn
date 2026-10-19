import { toastService } from '#/services/toastService';
import { act } from '@testing-library/react-native';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { ParseIngredientLinesDocument } from '#features/recipes/hooks/useIngredientPaste.generated';
import { useIngredientPaste } from '../useIngredientPaste';

jest.mock('#/utils/deviceLocale', () => ({
  getDeviceLocale: () => 'en-AU',
}));

beforeEach(() => {
  jest.clearAllMocks();
});

/** What `parseLines` resolves to for `lines`, answered by `answer`. */
async function parsedRows(answer: MockedResponse, lines: string[]) {
  const { result } = renderHookWithApollo(() => useIngredientPaste(), {
    operationMocks: [answer],
  });
  let rows: Awaited<ReturnType<typeof result.current.parseLines>> = [];
  await act(async () => {
    rows = await result.current.parseLines(lines);
  });
  return rows;
}

describe('useIngredientPaste', () => {
  it('turns the lines into rows in the order sent, with the device locale', async () => {
    const parse = recordMock(ParseIngredientLinesDocument, {
      data: {
        parseIngredientLines: {
          lines: [
            { name: 'flour', originalText: '2 cups flour' },
            { name: 'salt', originalText: 'salt, to taste' },
          ],
        },
      },
    });

    const rows = await parsedRows(parse.mock, [
      '2 cups flour',
      'salt, to taste',
    ]);

    expect(parse.fired).toEqual([
      {
        input: {
          lines: ['2 cups flour', 'salt, to taste'],
          locale: 'en-AU',
        },
      },
    ]);
    expect(rows).toEqual([
      expect.objectContaining({
        name: 'flour',
        originalText: '2 cups flour',
      }),
      expect.objectContaining({
        name: 'salt',
        originalText: 'salt, to taste',
      }),
    ]);
  });

  it.each([
    {
      name: 'says it could not read them, and adds nothing, when the request fails',
      error: new Error('network down'),
      copy: "Couldn't read those ingredients. Try again.",
    },
    {
      name: 'says a plan is needed, and adds nothing, when the server refuses for one',
      error: new CombinedGraphQLErrors({
        errors: [
          {
            message: 'refused',
            extensions: {
              code: TopLevelErrorCode.PremiumRequired,
              feature: 'INGREDIENT_PASTE',
              plan: 'PREMIUM',
            },
          },
        ],
      }),
      copy: 'This needs a Premium plan.',
    },
  ])('$name', async ({ error, copy }) => {
    const parse = recordMock(ParseIngredientLinesDocument, { error });

    expect(await parsedRows(parse.mock, ['2 cups flour'])).toBeNull();
    expect(jest.mocked(toastService.error)).toHaveBeenCalledWith(copy);
  });
});
