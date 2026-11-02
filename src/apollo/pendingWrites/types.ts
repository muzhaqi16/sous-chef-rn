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
  /**
   * What the write stays in order behind, on its way and in the queue, when it
   * changes something its input names no row for, such as a list answered
   * whole. Else its subject orders it.
   */
  orderedBy?(write: PendingWrite<TInputs>): string | undefined;
  /** Runs once, when the write is made, for what its caller did not pass. */
  capture?(cache: ApolloCache, variables: OperationVariables): Partial<TInputs>;
  apply(cache: ApolloCache, write: PendingWrite<TInputs>): void;
  /**
   * What the server's answer does not write itself, such as a new row's edge.
   * Also runs in a layer while reads in flight hold the write, where `evict`
   * leaves what the server holds.
   */
  commit?(
    cache: ApolloCache,
    write: PendingWrite<TInputs>,
    data: unknown,
  ): void;
  /**
   * The server refused a queued write for good: what it left outside the cache,
   * which dropping its layer cannot reach.
   */
  refused?(cache: ApolloCache, write: PendingWrite<TInputs>): void;
  /** False when `refused` hands the write back to a retry of its own. */
  recoverable?: false;
  /** How a stale write learns what became of it; absent, the person decides. */
  conflict?: ConflictRead<TInputs>;
  /**
   * Gets its `input.idempotencyKey` here, once, as the write is made, so a
   * resend of an edit the server took writes nothing and answers `converged`.
   */
  keyed?: true;
}

/** The row a stale write is compared with, on the device and on the server. */
export interface ConflictRead<TInputs extends LocalInputs = LocalInputs> {
  typename: string;
  /** Asks the server for the row, by `id`. */
  query: DocumentNode;
  /** The row's fields a write can change. */
  fragment: DocumentNode;
  /** What the write changed, in the row's own field names. */
  changed(inputs: TInputs): Readonly<Record<string, unknown>>;
}

export type LocalWriteTable = Record<string, LocalWrite>;
