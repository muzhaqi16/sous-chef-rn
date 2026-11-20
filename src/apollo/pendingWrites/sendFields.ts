import type { ApolloCache, OperationVariables } from '@apollo/client';
import type { Settled, SettleOptions } from '#/apollo/utils/settleMutation';
import type { EntityFieldsInputs } from './entityFields';
import type { LocalWriteSend } from './pendingWrites';
import { sendLocalWrite } from './useLocalWrite';

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
  const { document, ...told } = settle;
  return sendLocalWrite(cache, document, variables, mutate, told, {
    entity,
    fields,
  });
}
