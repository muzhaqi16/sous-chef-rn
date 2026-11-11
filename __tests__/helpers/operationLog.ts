import { ApolloLink } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { Observable } from 'rxjs';
import { act } from '@testing-library/react-native';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { withDeadline } from './cacheWaits';

type Stage = 'requested' | 'answered';

/**
 * A link a test puts ahead of its mocks (`links`) to await an operation
 * itself, never a clock: its nth request, or its nth answer handed to the
 * client. Await an answer inside `act` (`landed` does), which then lets what
 * it started finish rendering; a request a render sends is awaited outside,
 * as `act` holds that render. A wait that is never met fails with a count.
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
    const name = operationNameOf(document);
    const key = `${stage}:${name}`;
    if ((counts.get(key) ?? 0) >= nth) return Promise.resolve();
    return withDeadline(
      done => {
        const waiter = { key, nth, resolve: done };
        waiters.push(waiter);
        return () => {
          const at = waiters.indexOf(waiter);
          if (at >= 0) waiters.splice(at, 1);
        };
      },
      () => `${name} was ${stage} ${counts.get(key) ?? 0} time(s), not ${nth}`,
    );
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
    /** Waits for the `nth` answer inside `act`, so what it started renders. */
    landed: (document: DocumentNode, nth = 1) =>
      act(async () => {
        await until('answered', document, nth);
      }),
  };
}
