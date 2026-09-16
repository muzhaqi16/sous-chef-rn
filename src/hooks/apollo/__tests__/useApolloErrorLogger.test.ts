'use no memo';

// The dev console-warn branch suppresses the per-component network-error wall
// once the API is known-unavailable — default to "available".
jest.mock('#store', () => ({
  storeApi: { getState: jest.fn(() => ({})) },
}));
jest.mock('#store/slices/networkSlice', () => ({
  isApiUnavailable: jest.fn(() => false),
}));

import { renderHook } from '@testing-library/react-native';
import { ApolloClient, ApolloLink, InMemoryCache, gql } from '@apollo/client';
import { InvariantError } from '@apollo/client/utilities/invariant';
import { Observable } from 'rxjs';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { useApolloErrorLogger } from '../useApolloErrorLogger';
import { Telemetry } from '#/services/telemetry';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { logger } from '#/utils/environment';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
import { operationNameOf } from '#/apollo/utils/documentOperation';

const OPERATION = operationNameOf(GetPantryDocument);

const mockedIsApiUnavailable = isApiUnavailable as jest.Mock;

describe('useApolloErrorLogger', () => {
  // The hook logs through `logger`, which is auto-mocked for every test, so the
  // assertions read its calls rather than the console's. Spying on the console
  // would miss them — and would have to look past the '[WARN]' prefix `logger`
  // prepends, which is what made this test brittle before.
  const warnSpy = logger.warn as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsApiUnavailable.mockReturnValue(false);
  });

  afterEach(() => {});

  it('does nothing when error is undefined', () => {
    renderHook(() => useApolloErrorLogger(GetPantryDocument, undefined));

    expect(Telemetry.error).not.toHaveBeenCalled();
    expect(Telemetry.increment).not.toHaveBeenCalled();
  });

  it('reports a graphql error to telemetry', () => {
    const error = { message: 'Something went wrong' };
    renderHook(() => useApolloErrorLogger(GetPantryDocument, error));

    expect(Telemetry.error).toHaveBeenCalledWith(
      `Apollo query error: ${OPERATION}`,
      expect.objectContaining({
        operation_name: OPERATION,
        error_message: 'Something went wrong',
        error_type: 'graphql',
      }),
    );
  });

  it('increments apollo_client_errors_total counter for graphql errors', () => {
    const error = { message: 'Something went wrong' };
    renderHook(() => useApolloErrorLogger(GetPantryDocument, error));

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'apollo_client_errors_total',
      1,
      { operation: OPERATION, type: 'graphql' },
    );
  });

  it('reports an Apollo InvariantError as an invariant', () => {
    const error = new InvariantError('Could not identify object {}');
    renderHook(() => useApolloErrorLogger(GetPantryDocument, error));

    expect(Telemetry.error).toHaveBeenCalledWith(
      `Apollo invariant error: ${OPERATION}`,
      expect.objectContaining({ error_type: 'apollo_invariant' }),
    );
    expect(Telemetry.increment).toHaveBeenCalledWith(
      'apollo_client_errors_total',
      1,
      { operation: OPERATION, type: 'invariant' },
    );
  });

  it('does not classify by message text', () => {
    const error = new Error('Missing field "name" while extracting keyFields');
    renderHook(() => useApolloErrorLogger(GetPantryDocument, error));

    expect(Telemetry.increment).toHaveBeenCalledWith(
      'apollo_client_errors_total',
      1,
      { operation: OPERATION, type: 'graphql' },
    );
  });

  it('suppresses the dev query-error log once the API is unavailable, but still reports telemetry', () => {
    mockedIsApiUnavailable.mockReturnValue(true);
    const error = { message: 'Network request failed' };
    renderHook(() => useApolloErrorLogger(GetPantryDocument, error));

    const queryWarn = warnSpy.mock.calls.find(
      call => typeof call[0] === 'string' && call[0].includes('Query error'),
    );
    expect(queryWarn).toBeUndefined();
    // Telemetry still fires regardless of reachability.
    expect(Telemetry.error).toHaveBeenCalledWith(
      `Apollo query error: ${OPERATION}`,
      expect.objectContaining({ error_type: 'graphql' }),
    );
  });

  it('still logs an invariant in dev even when the API is unavailable', () => {
    mockedIsApiUnavailable.mockReturnValue(true);
    const error = new InvariantError('Cannot automatically merge arrays');
    renderHook(() => useApolloErrorLogger(GetPantryDocument, error));

    const invariantWarn = warnSpy.mock.calls.find(
      call =>
        typeof call[0] === 'string' && call[0].includes('Apollo invariant'),
    );
    expect(invariantWarn).toBeDefined();
  });

  it('does not re-report when error stays the same on rerender', () => {
    const error = { message: 'Some error' };
    const { rerender } = renderHook(
      ({ err }: { err: { message: string } | undefined }) =>
        useApolloErrorLogger(GetPantryDocument, err),
      { initialProps: { err: error } },
    );

    expect(Telemetry.error).toHaveBeenCalledTimes(1);

    // Same error reference on rerender
    rerender({ err: error });
    expect(Telemetry.error).toHaveBeenCalledTimes(1);
  });
});

// Pins what the INSTALLED Apollo delivers as a watched query's `error`, by
// driving a real client rather than restating its wording.
describe('Apollo faults reaching a query error', () => {
  const THING = gql`
    query Thing {
      thing {
        name
      }
    }
  `;

  // A result can arrive synchronously inside `subscribe`, so the subscription
  // is released once the promise settles rather than from the callback.
  const firstError = async (
    client: ApolloClient,
    act?: () => void,
  ): Promise<unknown> => {
    let resolveError: (error: unknown) => void = () => {};
    const error = new Promise<unknown>(resolve => {
      resolveError = resolve;
    });
    const subscription = client
      .watchQuery({ query: THING, fetchPolicy: 'network-only' })
      .subscribe(result => {
        if (result.error) resolveError(result.error);
      });
    act?.();
    const delivered = await error;
    subscription.unsubscribe();
    return delivered;
  };

  it('delivers a write the key fields refuse as an InvariantError', async () => {
    const client = new ApolloClient({
      cache: new InMemoryCache({
        typePolicies: { Thing: { keyFields: ['code'] } },
      }),
      link: new ApolloLink(
        () =>
          new Observable(observer => {
            observer.next({
              data: { thing: { __typename: 'Thing', name: 'no code' } },
            });
            observer.complete();
          }),
      ),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
    });

    await expect(firstError(client)).resolves.toBeInstanceOf(InvariantError);
  });

  it('delivers a store cleared under an in-flight query as an InvariantError', async () => {
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink(() => new Observable(() => {})),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
    });

    await expect(
      firstError(client, () => {
        client.clearStore().catch(() => {});
      }),
    ).resolves.toBeInstanceOf(InvariantError);
  });
});
