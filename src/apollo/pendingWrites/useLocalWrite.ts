import type {
  ApolloCache,
  OperationVariables,
  TypedDocumentNode,
} from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  settleMutation,
  type Settled,
  type SettleOptions,
} from '#/apollo/utils/settleMutation';
import type { EntityFieldsInputs } from './entityFields';
import { pendingWritesOf, type LocalWriteSend } from './pendingWrites';
import type { LocalInputs } from './types';

/** How a write's failure is told, less the document the hook already names. */
export type WriteSettle = Omit<SettleOptions, 'document'>;

type MutationResult<TData> = { data?: TData | null; error?: unknown };

type Mutate<TData, TVariables extends OperationVariables> = (
  write: LocalWriteSend<TVariables>,
) => Promise<MutationResult<TData>>;

export interface LocalWriteOptions<
  TData,
  TVariables extends OperationVariables,
> {
  /** This send's settle options, over the hook's. */
  settle?: Partial<WriteSettle>;
  /** Fires the mutation itself: for a send that reads its answer before commit. */
  run?: (
    mutate: Mutate<TData, TVariables>,
    write: LocalWriteSend<TVariables>,
  ) => Promise<MutationResult<TData>>;
}

/**
 * Sends one local-first write: held as a pending layer from before the send
 * until it settles applied, queued or failed.
 */
export function sendLocalWrite<TData, TVariables extends OperationVariables>(
  cache: ApolloCache,
  document: DocumentNode,
  variables: TVariables,
  mutate: Mutate<TData, TVariables>,
  settle: WriteSettle,
  inputs?: LocalInputs,
  run?: LocalWriteOptions<TData, TVariables>['run'],
): Promise<Settled<TData>> {
  return pendingWritesOf(cache).send(
    document,
    variables,
    write =>
      settleMutation(() => (run ? run(mutate, write) : mutate(write)), {
        ...settle,
        document,
      }),
    inputs,
  );
}

/**
 * The one way a local-first write is sent: the mutation, its local-first
 * marker, its pending layer and its settle step, named once. `send` takes the
 * write's variables and the inputs its local write reads; `sendFields` is a
 * send whose local write is the entity fields it names.
 */
export function useLocalWrite<TData, TVariables extends OperationVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  settle: WriteSettle,
) {
  const client = useApolloClient();
  const [mutate] = useMutation(document, { context: { localFirst: true } });

  const send = (
    variables: TVariables,
    inputs?: LocalInputs,
    options: LocalWriteOptions<TData, TVariables> = {},
  ): Promise<Settled<TData>> =>
    sendLocalWrite(
      client.cache,
      document,
      variables,
      mutate,
      { ...settle, ...options.settle },
      inputs,
      options.run,
    );

  const sendFields = (
    {
      entity,
      fields,
      variables,
    }: EntityFieldsInputs & { variables: TVariables },
    options?: LocalWriteOptions<TData, TVariables>,
  ): Promise<Settled<TData>> => send(variables, { entity, fields }, options);

  return { send, sendFields };
}
