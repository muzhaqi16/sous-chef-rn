import type { OperationVariables } from '@apollo/client';
import { isRecord } from '#/utils/isRecord';

/** The row a write's `input.id` names, read from the variables the queue keeps current. */
export const inputIdOf = ({
  input,
}: OperationVariables): string | undefined => {
  const value: unknown = input;
  return isRecord(value) && typeof value.id === 'string' ? value.id : undefined;
};
