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

  it("returns 'queued' for the queue's null-field result shape", () => {
    // The offline queue emits each top-level field as null (so Apollo's mutation
    // result write doesn't warn). A null payload field means queued, not rejected.
    const result = { data: { createPantryItem: null } };
    expect(classifyCreateResult(result, KEY, SUCCESS)).toBe('queued');
  });

  it("returns 'rejected' for a non-success payload (e.g. ValidationError)", () => {
    const result = {
      data: { createPantryItem: { __typename: 'ValidationError' } },
    };
    expect(classifyCreateResult(result, KEY, SUCCESS)).toBe('rejected');
  });

  it("returns 'created' for a replayed client-PK create (ConflictError code IDEMPOTENT_REPLAY)", () => {
    // An online double-tap / retry-after-lost-response re-creates a row whose
    // client-minted PK already exists; the server signals a safe replay with the
    // distinct IDEMPOTENT_REPLAY code. The row is already on the server → success.
    const result = {
      data: {
        createPantryItem: {
          __typename: 'ConflictError',
          code: 'IDEMPOTENT_REPLAY',
          message: 'A pantry item with this ID already exists',
        },
      },
    };
    expect(classifyCreateResult(result, KEY, SUCCESS)).toBe('created');
  });

  it("returns 'rejected' for a generic ConflictError (code CONFLICT — real conflict, e.g. duplicate name)", () => {
    // Must NOT converge: a genuine duplicate-name / business conflict carries the
    // generic CONFLICT code, and the row was never created — reverting is correct.
    const result = {
      data: {
        createShoppingList: {
          __typename: 'ConflictError',
          code: 'CONFLICT',
          message: 'A shopping list with this name already exists',
        },
      },
    };
    expect(
      classifyCreateResult(
        result,
        'createShoppingList',
        'CreateShoppingListPayload',
      ),
    ).toBe('rejected');
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
    // Wrong key → the looked-up payload field is absent → indistinguishable from
    // a queued result, so 'queued' (callers always pass the matching key).
    expect(classifyCreateResult(result, KEY, SUCCESS)).toBe('queued');
  });
});
