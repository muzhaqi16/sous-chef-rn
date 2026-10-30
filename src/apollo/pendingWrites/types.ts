import type { ApolloCache, OperationVariables } from '@apollo/client';
import type { DocumentNode } from 'graphql';

/** What a write read outside its variables when made. Queued with it, so JSON. */
export type LocalInputs = Readonly<Record<string, unknown>>;

/** A change the server has not taken yet. */
export interface PendingWrite {
  id: string;
  operationName: string;
  document: DocumentNode;
  variables: OperationVariables;
  inputs: LocalInputs;
}

/**
 * One operation's change on the device. `apply` must give the same result from
 * the same variables, inputs and cache: it re-runs whenever the server's data
 * under it changes, and after a restart.
 */
export interface LocalWrite {
  /** Runs once, when the write is made. */
  capture?(cache: ApolloCache, variables: OperationVariables): LocalInputs;
  apply(cache: ApolloCache, write: PendingWrite): void;
  /** What the server's answer does not write itself, such as a new row's edge. */
  commit?(cache: ApolloCache, write: PendingWrite, data: unknown): void;
}

export type LocalWriteTable = Record<string, LocalWrite>;
