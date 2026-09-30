import React, { type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { ApolloClient, ApolloLink } from '@apollo/client';
import { ApolloProvider, useMutation } from '@apollo/client/react';
import { of } from 'rxjs';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { ConvertExpiredBatchesToWasteDocument } from '#features/pantry/graphql/pantry.generated';

/**
 * Local-first hooks set `context: { localFirst: true }` on `useMutation`, not
 * on each call. Apollo 4.2's execute merges options with `compact`, so a call's
 * object `context` REPLACES the hook's; only the callback form merges into it.
 * `sous-chef/queueable-write-is-local-first` reports the replacing shape.
 */
function renderWithContextTap(contexts: Array<Record<string, unknown>>) {
  const tap = new ApolloLink(operation => {
    contexts.push(operation.getContext());
    return of({ data: { convertExpiredBatchesToWaste: null } });
  });
  const client = new ApolloClient({
    cache: makeCache(),
    link: tap,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(ApolloProvider, { client, children });
  return renderHook(
    () =>
      useMutation(ConvertExpiredBatchesToWasteDocument, {
        context: { localFirst: true },
      }),
    { wrapper },
  );
}

const variables = {
  input: {
    pantryItemId: 'item-1',
    idempotencyKey: 'key-1',
    today: '2026-09-29',
  },
  today: '2026-09-29',
};

describe('useMutation hook-level context', () => {
  it('reaches the link when the call passes no context', async () => {
    const contexts: Array<Record<string, unknown>> = [];
    const { result } = renderWithContextTap(contexts);

    await act(async () => {
      await result.current[0]({ variables });
    });

    expect(contexts[0]?.localFirst).toBe(true);
  });

  it('is replaced by a per-call context object', async () => {
    const contexts: Array<Record<string, unknown>> = [];
    const { result } = renderWithContextTap(contexts);

    await act(async () => {
      await result.current[0]({
        variables,
        context: { skipRetryLink: true },
      });
    });

    expect(contexts[0]?.localFirst).toBeUndefined();
    expect(contexts[0]?.skipRetryLink).toBe(true);
  });

  it('is merged by the per-call callback form', async () => {
    const contexts: Array<Record<string, unknown>> = [];
    const { result } = renderWithContextTap(contexts);

    await act(async () => {
      await result.current[0]({
        variables,
        context: hookContext => ({ ...hookContext, skipRetryLink: true }),
      });
    });

    expect(contexts[0]?.localFirst).toBe(true);
    expect(contexts[0]?.skipRetryLink).toBe(true);
  });
});
