import { classifyCreateResult } from '../classifyCreateResult';

describe('classifyCreateResult', () => {
  const KEY = 'createPantryItem';
  const SUCCESS = 'CreatePantryItemPayload';

  it("returns 'created' for a success payload", () => {
    const result = {
      data: { createPantryItem: { __typename: 'CreatePantryItemPayload' } },
    };
    expect(classifyCreateResult(result, KEY, SUCCESS)).toBe('created');
  });

  it("returns 'queued' when there is no data and no error (offline replay)", () => {
    expect(classifyCreateResult({ data: null }, KEY, SUCCESS)).toBe('queued');
    expect(classifyCreateResult({}, KEY, SUCCESS)).toBe('queued');
  });

  it("returns 'rejected' for a non-success payload (e.g. ValidationError)", () => {
    const result = {
      data: { createPantryItem: { __typename: 'ValidationError' } },
    };
    expect(classifyCreateResult(result, KEY, SUCCESS)).toBe('rejected');
  });

  it("returns 'rejected' when a GraphQL error is surfaced", () => {
    expect(
      classifyCreateResult({ error: new Error('boom') }, KEY, SUCCESS),
    ).toBe('rejected');
  });

  it("returns 'rejected' when the call threw (falsy result)", () => {
    expect(classifyCreateResult(null, KEY, SUCCESS)).toBe('rejected');
    expect(classifyCreateResult(undefined, KEY, SUCCESS)).toBe('rejected');
  });

  it('keys off the supplied payload field name', () => {
    const result = {
      data: {
        addItemToShoppingList: {
          __typename: 'AddItemToShoppingListPayload',
        },
      },
    };
    expect(
      classifyCreateResult(
        result,
        'addItemToShoppingList',
        'AddItemToShoppingListPayload',
      ),
    ).toBe('created');
    // Wrong key → the success payload isn't found → treated as rejected (data present).
    expect(classifyCreateResult(result, KEY, SUCCESS)).toBe('rejected');
  });
});
