import * as ts from 'typescript';
import {
  calleeName,
  lineOf,
  nodesOf,
  parseSource,
  productionSources,
} from '#/test-utils/sourceAst';

/**
 * Every `useSubscription` call must be paired with
 * `useSubscriptionTransportRecovery`.
 *
 * Recovery is a separate line beside the subscription rather than a wrapper, so
 * that the subscription keeps Apollo's own typing and the recovery is visible
 * at the call site. The cost of that choice is that it can be forgotten — and
 * forgetting it is invisible: the subscription works normally right up until
 * the socket ends it with a code graphql-ws refuses to retry, after which it
 * delivers nothing for the rest of the session, with no error and no log.
 *
 * That is what this test is for. It reads source rather than rendering, because
 * the failure it guards is the ABSENCE of a call, which no render can observe.
 */

const RECOVERY = 'useSubscriptionTransportRecovery';

const enclosingFunction = (node: ts.Node): ts.Node => {
  let current: ts.Node = node;
  while (!ts.isFunctionLike(current) && !ts.isSourceFile(current)) {
    current = current.parent;
  }
  return current;
};

const subscriptionsIn = (source: ts.SourceFile) =>
  nodesOf(source)
    .filter(ts.isCallExpression)
    .filter(call => calleeName(call) === 'useSubscription');

/**
 * Each subscription with no recovery of its own, as `file:line`: the recovery
 * names the same document and the subscription's own result.
 */
function unrecovered(file: string, text?: string): string[] {
  return subscriptionsIn(parseSource(file, text))
    .filter(call => {
      const holder = call.parent;
      const [document] = call.arguments;
      if (!document || !ts.isVariableDeclaration(holder)) return true;
      const result = holder.name.getText();
      return !nodesOf(enclosingFunction(holder))
        .filter(ts.isCallExpression)
        .some(recovery => {
          const [doc, value] = recovery.arguments;
          return (
            calleeName(recovery) === RECOVERY &&
            doc?.getText() === document.getText() &&
            value?.getText() === result
          );
        });
    })
    .map(call => `${file}:${lineOf(call)}`);
}

describe('subscription transport recovery coverage', () => {
  it('catches a subscription whose recovery was written for another', () => {
    const planted = `
      function useEvents() {
        const homeEvents = useSubscription(HomeEventsDocument, options);
        const listEvents = useSubscription(ListEventsDocument, options);
        useSubscriptionTransportRecovery(HomeEventsDocument, homeEvents, skip);
        useSubscriptionTransportRecovery(HomeEventsDocument, homeEvents, skip);
      }`;

    expect(unrecovered('planted.ts', planted)).toEqual(['planted.ts:4']);
  });

  const files = productionSources().filter(
    // The hook itself documents the pairing; it does not subscribe.
    file => !file.endsWith(`${RECOVERY}.ts`),
  );

  it('finds the subscription call sites it is meant to be guarding', () => {
    // A rename or a move that made the scan match nothing would otherwise let
    // this test pass by checking an empty list.
    expect(
      files.flatMap(file => subscriptionsIn(parseSource(file))).length,
    ).toBeGreaterThanOrEqual(6);
  });

  it('pairs every useSubscription with its own transport recovery', () => {
    expect(files.flatMap(file => unrecovered(file))).toEqual([]);
  });
});
