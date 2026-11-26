import type { OperationVariables, TypedDocumentNode } from '@apollo/client';
import type { LocalInputs, LocalWrite, LocalWriteBinding } from './types';

/** Binds a document to the local write it sends as; does nothing at runtime. */
export const bindLocalWrite = <
  TData,
  TVariables extends OperationVariables,
  TInputs extends LocalInputs,
>(
  document: TypedDocumentNode<TData, TVariables>,
  write: LocalWrite<TInputs>,
): LocalWriteBinding<TData, TVariables, TInputs> => ({ document, write });
