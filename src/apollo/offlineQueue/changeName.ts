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
 * What the person calls the row a change was to, from the change or the row it
 * changed; a change to several rows names each. The toast and the list of
 * changes not saved both say it.
 */
export function nameOfChange({
  pendingWrite,
  variables,
}: Pick<QueuedMutation, 'pendingWrite' | 'variables'>): string | undefined {
  const inputs = pendingWrite?.inputs;
  for (const source of [
    inputs?.fields,
    inputs?.row,
    inputs?.baseline,
    variables.input,
  ]) {
    const name = nameIn(source);
    if (name) return name;
  }
  const rows: unknown = inputs?.rows;
  const names = Array.isArray(rows)
    ? rows.flatMap((row: unknown) => nameIn(row) ?? [])
    : [];
  return names.length > 0 ? names.join(', ') : undefined;
}
