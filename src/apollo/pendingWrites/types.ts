import type {
  ApolloCache,
  OperationVariables,
  TypedDocumentNode,
} from '@apollo/client';
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
 * The row a write's input names, where it is not `input.id` as a
 * `Create|Update|Delete<Type>Input` names it.
 */
export interface WriteSubject {
  /** The input field naming it; a list names one row per entry. */
  key?: string;
  /** The field naming each listed entry's row; `id` unless stated. */
  rowKey?: string;
  /** The device mints it, as it does a `Create*Input.id`. */
  mints?: true;
  /** The write deletes it, as a `Delete*Input` does. */
  deletes?: true;
}

/**
 * One operation's change on the device. `apply` must give the same result from
 * the same variables, inputs and cache: it re-runs whenever the server's data
 * under it changes, and after a restart. Members are properties, not methods,
 * so a write's inputs are checked strictly where it is bound.
 */
export interface LocalWrite<TInputs extends LocalInputs = LocalInputs> {
  /** What the queue reads as the write's row, where the input's name does not say. */
  subject?: WriteSubject;
  /**
   * What the write stays in order behind, on its way and in the queue, when it
   * changes something its input names no row for, such as a list answered
   * whole. Else its subject orders it.
   */
  orderedBy?: (write: PendingWrite<TInputs>) => string | undefined;
  /** Runs once, when the write is made, for what its caller did not pass. */
  capture?: (
    cache: ApolloCache,
    variables: OperationVariables,
  ) => Partial<TInputs>;
  apply: (cache: ApolloCache, write: PendingWrite<TInputs>) => void;
  /**
   * What the server's answer does not write itself, such as a new row's edge.
   * Also runs in a layer while reads in flight hold the write, where `evict`
   * leaves what the server holds.
   */
  commit?: (
    cache: ApolloCache,
    write: PendingWrite<TInputs>,
    data: unknown,
  ) => void;
  /**
   * The server refused a queued write for good: what it left outside the cache,
   * which dropping its layer cannot reach.
   */
  refused?: (cache: ApolloCache, write: PendingWrite<TInputs>) => void;
  /** False when `refused` hands the write back to a retry of its own. */
  recoverable?: false;
  /** How a stale write learns what became of it; absent, the person decides. */
  conflict?: ConflictRead<TInputs>;
  /**
   * Changes one row and needs nothing from its answer, so a pull confirming
   * that row settles it: the page has already put the row where the server has
   * it. Off, a confirmed write replays and converges, which costs only a send.
   */
  settlesFromFeed?: true;
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
  changed: (inputs: TInputs) => Readonly<Record<string, unknown>>;
}

/** Where a conflict's row is read from, which is all the kernel asks of it. */
export type ConflictRow = Pick<ConflictRead, 'typename' | 'query' | 'fragment'>;

/**
 * A write as the kernel holds it, whatever its inputs. Its members are methods,
 * which TypeScript checks bivariantly, so every bound `LocalWrite` fits here
 * with no cast; its binding typed the inputs when it was sent.
 */
export interface RegisteredWrite {
  subject?: WriteSubject;
  orderedBy?(write: PendingWrite): string | undefined;
  capture?(cache: ApolloCache, variables: OperationVariables): LocalInputs;
  apply(cache: ApolloCache, write: PendingWrite): void;
  commit?(cache: ApolloCache, write: PendingWrite, data: unknown): void;
  refused?(cache: ApolloCache, write: PendingWrite): void;
  recoverable?: false;
  conflict?: RegisteredConflict;
  settlesFromFeed?: true;
  keyed?: true;
}

/** A conflict read as the kernel holds it, whatever its inputs. */
export interface RegisteredConflict extends ConflictRow {
  changed(inputs: LocalInputs): Readonly<Record<string, unknown>>;
}

export type LocalWriteTable = Record<string, RegisteredWrite>;

/**
 * A document bound to the local write it sends as. A sender holds the binding,
 * so its variables, inputs and answer are all checked against the one write.
 */
export interface LocalWriteBinding<
  TData,
  TVariables extends OperationVariables,
  TInputs extends LocalInputs,
> {
  readonly document: TypedDocumentNode<TData, TVariables>;
  readonly write: LocalWrite<TInputs>;
}

/** A binding as the kernel's table lists it, its types erased. */
export interface RegisteredBinding {
  readonly document: DocumentNode;
  readonly write: RegisteredWrite;
}
