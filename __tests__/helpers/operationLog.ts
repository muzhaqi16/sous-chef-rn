import { ApolloLink } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { Observable } from 'rxjs';
import { operationNameOf } from '#/apollo/utils/documentOperation';

type Stage = 'requested' | 'answered';

/**
 * A link a test puts ahead of its mocks (`links`) to await an operation
 * itself, never a clock: its nth request, or its nth answer handed to the
 * client. Await one inside `act`, which then lets what the answer started
 * finish rendering.
 */
export function operationLog() {
  const counts = new Map<string, number>();
  const waiters: Array<{ key: string; nth: number; resolve: () => void }> = [];

  const count = (stage: Stage, name: string) => {
    const key = `${stage}:${name}`;
    const seen = (counts.get(key) ?? 0) + 1;
    counts.set(key, seen);
    for (const waiter of waiters.filter(w => w.key === key && w.nth <= seen)) {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve();
    }
  };

  const until = (stage: Stage, document: DocumentNode, nth: number) => {
    const key = `${stage}:${operationNameOf(document)}`;
    if ((counts.get(key) ?? 0) >= nth) return Promise.resolve();
    return new Promise<void>(resolve => {
      waiters.push({ key, nth, resolve });
    });
  };

  const link = new ApolloLink(
    (operation, forward) =>
      new Observable(observer => {
        const name = operation.operationName ?? '';
        count('requested', name);
        const subscription = forward(operation).subscribe({
          next: value => {
            observer.next(value);
          },
          error: (error: unknown) => {
            observer.error(error);
            count('answered', name);
          },
          complete: () => {
            observer.complete();
            count('answered', name);
          },
        });
        return () => {
          subscription.unsubscribe();
        };
      }),
  );

  return {
    link,
    /** Resolves once the operation has been sent `nth` times. */
    requested: (document: DocumentNode, nth = 1) =>
      until('requested', document, nth),
    /** Resolves once the operation's `nth` answer has reached the client. */
    answered: (document: DocumentNode, nth = 1) =>
      until('answered', document, nth),
  };
}
