import type { ApolloCache, ApolloClient } from '@apollo/client';
import type { OperationVariables } from '@apollo/client';
import { fromServer } from '#/apollo/utils/fromServer';
import { isRecord } from '#/utils/isRecord';
import type { ConflictRead } from './types';

export type RowFields = Readonly<Record<string, unknown>>;

export type ConflictOutcome = 'landed' | 'merge' | 'clash';

/** Stamped by the device, or restated by the server in its own form. */
const UNCOMPARED = new Set(['updatedAt', 'quantityInput']);

const isBlank = (value: unknown) =>
  value === null || value === undefined || value === '';

/** A nested record is the same by id; `mine` may hold less than `theirs`. */
function sameValue(mine: unknown, theirs: unknown): boolean {
  if (isBlank(mine) || isBlank(theirs)) return isBlank(mine) && isBlank(theirs);
  if (Array.isArray(mine) && Array.isArray(theirs)) {
    return (
      mine.length === theirs.length &&
      mine.every((value, index) => sameValue(value, theirs[index]))
    );
  }
  if (isRecord(mine) && isRecord(theirs)) {
    if ('id' in mine) return mine.id === theirs.id;
    return Object.keys(mine)
      .filter(key => key !== '__typename')
      .every(key => sameValue(mine[key], theirs[key]));
  }
  return mine === theirs;
}

function readRow(
  cache: ApolloCache,
  { typename, fragment }: ConflictRead,
  id: string,
  optimistic: boolean,
): RowFields | null {
  return cache.readFragment<Record<string, unknown>>({
    id: cache.identify({ __typename: typename, id }),
    fragment,
    optimistic,
    returnPartialData: true,
  });
}

/** The row as the person saw it, for `capture`, before the write's layer. */
export function rowBaseline(
  cache: ApolloCache,
  conflict: ConflictRead,
  variables: OperationVariables,
): RowFields | undefined {
  const input: unknown = variables.input;
  if (!isRecord(input) || typeof input.id !== 'string') return undefined;
  return readRow(cache, conflict, input.id, true) ?? undefined;
}

/** The row as the server holds it now, or `undefined` if it cannot be asked. */
export async function readServerRow(
  client: ApolloClient,
  conflict: ConflictRead,
  id: string,
): Promise<RowFields | undefined> {
  try {
    const answered = await fromServer(() =>
      client.query({
        query: conflict.query,
        variables: { id },
        fetchPolicy: 'network-only',
      }),
    );
    if (!answered) return undefined;
  } catch {
    return undefined;
  }
  return readRow(client.cache, conflict, id, false) ?? undefined;
}

/**
 * What became of a write the server called stale, from the fields it changed:
 * all of them hold what it sent, so it landed or both agreed; any holds neither
 * what it sent nor what the person saw, so someone else changed it. A field the
 * row does not state, or a write with nothing to compare, is the person's.
 */
export function conflictOutcome(
  changed: RowFields,
  baseline: unknown,
  row: RowFields,
): ConflictOutcome {
  const fields = Object.keys(changed).filter(field => !UNCOMPARED.has(field));
  if (fields.length === 0) return 'clash';
  const clashes = fields.some(field => {
    if (!(field in row)) return true;
    if (sameValue(changed[field], row[field])) return false;
    return !(
      isRecord(baseline) &&
      field in baseline &&
      sameValue(baseline[field], row[field])
    );
  });
  if (clashes) return 'clash';
  return fields.every(field => sameValue(changed[field], row[field]))
    ? 'landed'
    : 'merge';
}
