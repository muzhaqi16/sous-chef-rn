import { ApolloLink } from '@apollo/client';
import { isQueryOperation } from '@apollo/client/utilities';
import { map } from 'rxjs';
import { isRecord } from '#/utils/isRecord';

type ErrorPath = readonly (string | number)[];

/** A list row's id, on the row or on the node of a connection's edge. */
function rowId(row: unknown): unknown {
  if (!isRecord(row)) return undefined;
  return isRecord(row.node) ? row.node.id : row.id;
}

/** The list row the answer put at `index`, as the device holds it. */
function heldRow(
  answer: readonly unknown[],
  held: readonly unknown[],
  index: number,
): unknown {
  const id = rowId(answer[index]);
  return id === undefined
    ? undefined
    : held.find(heldOne => rowId(heldOne) === id);
}

/**
 * The answer with the held value back at `path`. A failure nulls its field or,
 * for a non-null one, the nearest nullable parent, so the first null on the way
 * down is what it took.
 */
function restored(answer: unknown, held: unknown, path: ErrorPath): unknown {
  const [step, ...rest] = path;
  if (step === undefined || answer === null) return held;
  if (typeof step === 'number') {
    if (!Array.isArray(answer) || !Array.isArray(held)) return answer;
    const rows: readonly unknown[] = answer;
    const row = heldRow(rows, held, step);
    return row === undefined
      ? rows
      : rows.map((one, index) =>
          index === step ? restored(one, row, rest) : one,
        );
  }
  return isRecord(answer) && isRecord(held) && step in held
    ? { ...answer, [step]: restored(answer[step], held[step], rest) }
    : answer;
}

/**
 * A read's failed field answers `null`, which would overwrite what the device
 * holds. The held value goes back at each error's path; the errors still reach
 * the caller. With no complete copy held, the answer lands as it came.
 */
export const createHeldFieldLink = () =>
  new ApolloLink((operation, forward) => {
    if (!isQueryOperation(operation.query)) return forward(operation);
    return forward(operation).pipe(
      map(result => {
        if (!('data' in result) || !result.data || !result.errors?.length) {
          return result;
        }
        const held = operation.client.cache.readQuery<Record<string, unknown>>({
          query: operation.query,
          variables: operation.variables,
          optimistic: false,
        });
        if (!held) return result;
        const data = result.errors.reduce<unknown>(
          (answer, { path }) => (path ? restored(answer, held, path) : answer),
          result.data,
        );
        return isRecord(data) ? { ...result, data } : result;
      }),
    );
  });
