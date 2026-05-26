import { isType, isEither } from '../typeGuards';

type TestUnion =
  | { __typename: 'SuccessPayload'; data: string }
  | { __typename: 'ValidationError'; message: string; field: string }
  | { __typename: 'ConflictError'; message: string }
  | { __typename: 'NotFoundError'; message: string; resource: string };

describe('isType', () => {
  it('narrows to the matching variant', () => {
    const payload = {
      __typename: 'SuccessPayload',
      data: 'ok',
    } as TestUnion;

    if (isType(payload, 'SuccessPayload')) {
      expect(payload.data).toBe('ok');
    } else {
      fail('should have matched SuccessPayload');
    }
  });

  it('returns false for a different typename', () => {
    const payload = {
      __typename: 'ValidationError',
      message: 'bad input',
      field: 'name',
    } as TestUnion;

    expect(isType(payload, 'SuccessPayload')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isType(null as TestUnion | null, 'SuccessPayload')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isType(undefined as TestUnion | undefined, 'SuccessPayload')).toBe(
      false,
    );
  });
});

describe('isEither', () => {
  it('matches one of multiple typenames', () => {
    const payload = {
      __typename: 'ConflictError',
      message: 'conflict',
    } as TestUnion;

    expect(isEither(payload, ['ValidationError', 'ConflictError'])).toBe(true);
  });

  it('returns false when typename is not in list', () => {
    const payload = {
      __typename: 'NotFoundError',
      message: 'not found',
      resource: 'Item',
    } as TestUnion;

    expect(isEither(payload, ['ValidationError', 'ConflictError'])).toBe(false);
  });

  it('returns false for null', () => {
    expect(
      isEither(null as TestUnion | null, ['ValidationError', 'ConflictError']),
    ).toBe(false);
  });
});
