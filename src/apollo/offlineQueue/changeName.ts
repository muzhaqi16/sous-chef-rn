import type { ApolloCache } from '@apollo/client';
import { isRecord } from '#utils/isRecord';
import type { QueuedMutation } from './types';

const stringIn = (source: unknown, field: string): string | undefined => {
  if (!isRecord(source)) return undefined;
  const value = source[field];
  return typeof value === 'string' && value !== '' ? value : undefined;
};

const nameIn = (source: unknown): string | undefined =>
  stringIn(source, 'itemName') ?? stringIn(source, 'name');

/**
 * What the person calls the row a change was to: the name it was given when
 * made, else from the change or the row it changed; a change to several rows
 * names each. The toast and the list of changes not saved both say it.
 */
export function nameOfChange({
  name,
  pendingWrite,
  variables,
}: Pick<QueuedMutation, 'name' | 'pendingWrite' | 'variables'>):
  | string
  | undefined {
  if (name) return name;
  const inputs = pendingWrite?.inputs;
  for (const source of [
    inputs?.fields,
    inputs?.row,
    inputs?.baseline,
    variables.input,
  ]) {
    const named = nameIn(source);
    if (named) return named;
  }
  const rows: unknown = inputs?.rows;
  const names = Array.isArray(rows)
    ? rows.flatMap((row: unknown) => nameIn(row) ?? [])
    : [];
  return names.length > 0 ? names.join(', ') : undefined;
}

/**
 * What the person calls rows a write names by id alone, as the device holds
 * them when it is made: a row can be gone by the time the change is refused.
 * Ids are unique cuids, so a `Type:id` key is found by its id.
 */
export function nameOfRows(
  cache: ApolloCache,
  ids: readonly string[],
): string | undefined {
  if (ids.length === 0) return undefined;
  const store: unknown = cache.extract();
  if (!isRecord(store)) return undefined;
  const keys = Object.keys(store);
  const names = ids.flatMap(id => {
    const key = keys.find(entry => entry.endsWith(`:${id}`));
    const name = key ? nameIn(store[key]) : undefined;
    return name ? [name] : [];
  });
  return names.length > 0 ? names.join(', ') : undefined;
}
