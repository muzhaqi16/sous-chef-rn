import type { DocumentNode } from 'graphql';
import { byOperation } from '#apollo/utils/documentOperation';
import { FEATURE_LOCAL_WRITES } from '#features/registry.data';
import { SHARED_LOCAL_WRITES } from './sharedWrites';
import type { LocalWriteTable, RegisteredWrite } from './types';

/**
 * Every local write, keyed by the operation its document declares: the
 * kernel's own over the shared documents, then each feature's. Derived from
 * the bindings, so a sender and the table name the same write.
 */
export const LOCAL_WRITES: LocalWriteTable = byOperation<RegisteredWrite>(
  [...SHARED_LOCAL_WRITES, ...FEATURE_LOCAL_WRITES].map(
    ({ document, write }): readonly [DocumentNode, RegisteredWrite] => [
      document,
      write,
    ],
  ),
);
