import type { ApolloCache, OperationVariables } from '@apollo/client';
import type { DocumentNode } from 'graphql';

/** What a write read outside its variables when made. Queued with it, so JSON. */
export type LocalInputs = Readonly<Record<string, unknown>>;

/** A change the server has not taken yet. */
export interface PendingWrite<TInputs extends LocalInputs = LocalInputs> {
  id: string;
  operationName: string;
  document: DocumentNode;
  variables: OperationVariables;
  inputs: TInputs;
}

/**
 * One operation's change on the device. `apply` must give the same result from
 * the same variables, inputs and cache: it re-runs whenever the server's data
 * under it changes, and after a restart.
 */
export interface LocalWrite<TInputs extends LocalInputs = LocalInputs> {
  /** Runs once, when the write is made, for what its caller did not pass. */
  capture?(cache: ApolloCache, variables: OperationVariables): TInputs;
  apply(cache: ApolloCache, write: PendingWrite<TInputs>): void;
  /** What the server's answer does not write itself, such as a new row's edge. */
  commit?(
    cache: ApolloCache,
    write: PendingWrite<TInputs>,
    data: unknown,
  ): void;
}

export type LocalWriteTable = Record<string, LocalWrite>;
