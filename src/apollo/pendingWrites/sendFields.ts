import type { ApolloCache, OperationVariables } from '@apollo/client';
import {
  settleMutation,
  type Settled,
  type SettleOptions,
} from '#/apollo/utils/settleMutation';
import type { EntityFieldsInputs } from './entityFields';
import { pendingWritesOf, type LocalWriteSend } from './pendingWrites';

interface FieldsWrite<TData, TVariables extends OperationVariables>
  extends EntityFieldsInputs {
  variables: TVariables;
  mutate: (
    write: LocalWriteSend<TVariables>,
  ) => Promise<{ data?: TData | null; error?: unknown }>;
  settle: SettleOptions;
}

/** Sends a write registered as `entityFields`, its fields shown until it settles. */
export function sendFields<TData, TVariables extends OperationVariables>(
  cache: ApolloCache,
  { entity, fields, variables, mutate, settle }: FieldsWrite<TData, TVariables>,
): Promise<Settled<TData>> {
  const inputs: EntityFieldsInputs = { entity, fields };
  return pendingWritesOf(cache).send(
    settle.document,
    variables,
    write => settleMutation(() => mutate(write), settle),
    inputs,
  );
}
