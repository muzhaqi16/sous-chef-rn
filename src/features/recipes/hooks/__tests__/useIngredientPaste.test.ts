import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { ParseIngredientLinesDocument } from '#features/recipes/hooks/useIngredientPaste.generated';
import { useIngredientPaste } from '../useIngredientPaste';

const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('#/utils/deviceLocale', () => ({
  getDeviceLocale: () => 'en-AU',
}));

beforeEach(() => {
  jest.clearAllMocks();
});

type Payload = NonNullable<
  MockDataFor<typeof ParseIngredientLinesDocument>['parseIngredientLines']
>;
type ParsedLine = NonNullable<NonNullable<Payload['lines']>[number]>;

const parsed = (name: string, originalText: string): ParsedLine => ({
  __typename: 'ParsedIngredientLine',
  name,
  originalText,
});

describe('useIngredientPaste', () => {
  it('turns the lines into rows in the order sent, with the device locale', async () => {
    const parse = recordMock(ParseIngredientLinesDocument, {
      data: {
        parseIngredientLines: {
          __typename: 'ParseIngredientLinesPayload',
          lines: [
            parsed('flour', '2 cups flour'),
            parsed('salt', 'salt, to taste'),
          ],
        },
      },
    });
    const { result } = renderHookWithApollo(() => useIngredientPaste(), {
      operationMocks: [parse.mock],
    });

    let rows: Awaited<ReturnType<typeof result.current.parseLines>> = null;
    await act(async () => {
      rows = await result.current.parseLines([
        '2 cups flour',
        'salt, to taste',
      ]);
    });

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

  it('says it could not read them, and adds nothing, when the request fails', async () => {
    const parse = recordMock(ParseIngredientLinesDocument, {
      error: new Error('network down'),
    });
    const { result } = renderHookWithApollo(() => useIngredientPaste(), {
      operationMocks: [parse.mock],
    });

    let rows: Awaited<ReturnType<typeof result.current.parseLines>> = [];
    await act(async () => {
      rows = await result.current.parseLines(['2 cups flour']);
    });

    expect(rows).toBeNull();
    expect(mockToastError).toHaveBeenCalledWith(
      "Couldn't read those ingredients. Try again.",
    );
  });
});
