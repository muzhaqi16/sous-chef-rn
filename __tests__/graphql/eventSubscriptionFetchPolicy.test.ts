import { readFileSync } from 'fs';
import { sync as glob } from 'glob';
import {
  Kind,
  parse,
  visit,
  type FieldNode,
  type SelectionSetNode,
} from 'graphql';
import * as ts from 'typescript';
import {
  calleeName,
  nodesOf,
  parseSource,
  productionSources,
} from '#/test-utils/sourceAst';

/**
 * An event subscription whose payload is an envelope plus a bare `node { id }`
 * must run with `fetchPolicy: 'no-cache'`.
 *
 * Cached, the envelope is written through as an entity carrying nothing but its
 * key. That is worst on a delete: the row is evicted locally before the
 * mutation fires, the server pushes the event, and the write re-creates the
 * entity the event exists to announce is gone. Its connection edge stops
 * dangling, the node now lacks every field the list query selects, and Apollo
 * repairs the incomplete result by refetching the whole page — one network
 * round-trip per delete, on a stream that is live app-wide.
 *
 * The rule is narrow on purpose: it applies only when every branch under `node`
 * selects nothing but `id`/`__typename`. `UserEvents` selects real fields and
 * is a legitimate write-through, so it is exempt by the same test that catches
 * the others — the shape decides, not a hand-kept list.
 *
 * Found the hard way on `PantryEvents` and `MyShoppingListsEvents`; `HomeEvents`
 * and `MealPlanEvents` had the identical shape and were still cached.
 */

// `version` is metadata, not data a screen reads: every network read of a
// versioned row selects it (`sous-chef/network-read-selects-version`).
const IDENTITY_FIELDS = new Set(['id', '__typename', 'version']);

/** Only identity fields, directly or in inline fragments; a named spread is data. */
const isIdentityOnly = (set: SelectionSetNode): boolean =>
  set.selections.length > 0 &&
  set.selections.every(selection =>
    selection.kind === Kind.FIELD
      ? IDENTITY_FIELDS.has(selection.name.value) && !selection.selectionSet
      : selection.kind === Kind.INLINE_FRAGMENT
      ? isIdentityOnly(selection.selectionSet)
      : false,
  );

/** Each subscription in a document, and whether its `node` is identity-only. */
function subscriptionsIn(text: string) {
  return parse(text).definitions.flatMap(definition => {
    if (
      definition.kind !== Kind.OPERATION_DEFINITION ||
      definition.operation !== 'subscription' ||
      !definition.name
    ) {
      return [];
    }
    let node: FieldNode | undefined;
    visit(definition, {
      Field(field) {
        if (!node && field.name.value === 'node') node = field;
      },
    });
    return [
      {
        name: definition.name.value,
        identityOnly: !!node?.selectionSet && isIdentityOnly(node.selectionSet),
      },
    ];
  });
}

const subscriptions = glob('src/**/*.graphql', {
  ignore: ['**/generated/**'],
}).flatMap(file => subscriptionsIn(readFileSync(file, 'utf8')));

/** The `fetchPolicy` a call passes, from its options object or the name holding it. */
function fetchPolicyOf(call: ts.CallExpression): string | undefined {
  let options = call.arguments[1];
  if (options && ts.isIdentifier(options)) {
    const name = options.text;
    const declaration = nodesOf(call.getSourceFile()).find(
      (node): node is ts.VariableDeclaration =>
        ts.isVariableDeclaration(node) && node.name.getText() === name,
    );
    options = declaration?.initializer;
  }
  if (!options || !ts.isObjectLiteralExpression(options)) return undefined;
  const policy = options.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      property.name.getText() === 'fetchPolicy',
  );
  return policy && ts.isStringLiteral(policy.initializer)
    ? policy.initializer.text
    : undefined;
}

/** Each `useSubscription(<name>Document, …)` call's fetch policy. */
const callPolicies = (name: string, file: string, text?: string) =>
  nodesOf(parseSource(file, text))
    .filter(ts.isCallExpression)
    .filter(
      call =>
        calleeName(call) === 'useSubscription' &&
        call.arguments[0]?.getText() === `${name}Document`,
    )
    .map(fetchPolicyOf);

const SOURCES = productionSources();

describe('event subscriptions with an identity-only node', () => {
  it('reads a node past a comment, and a policy past its neighbour', () => {
    expect(
      subscriptionsIn(`
        subscription ListEvents {
          listEvents {
            # the envelope: node { id } only
            node { id ...ListReaders }
          }
        }
        fragment ListReaders on List { name }`),
    ).toEqual([{ name: 'ListEvents', identityOnly: false }]);

    const planted = `
      const options = { fetchPolicy: 'no-cache' };
      useSubscription(ListEventsDocument, {
          variables,
        });
      useSubscription(HomeEventsDocument, options);`;
    expect(callPolicies('ListEvents', 'planted.ts', planted)).toEqual([
      undefined,
    ]);
    expect(callPolicies('HomeEvents', 'planted.ts', planted)).toEqual([
      'no-cache',
    ]);
  });

  it('finds the subscription documents to check', () => {
    expect(subscriptions.length).toBeGreaterThan(0);
  });

  const identityOnly = subscriptions.filter(s => s.identityOnly);

  // Guards the classifier itself: if either of these flips, the rule below has
  // stopped meaning what it says. `UserEvents` selects its fields directly;
  // `NotificationEvents` selects them through a named spread, and the unread
  // badge depends on Apollo normalizing that node BEFORE `onData` runs.
  it.each(['UserEvents', 'NotificationEvents'])(
    'classifies %s as a real write-through, not an envelope',
    name => {
      expect(subscriptions.find(s => s.name === name)?.identityOnly).toBe(
        false,
      );
    },
  );

  it.each(identityOnly.map(s => s.name))(
    '%s runs with fetchPolicy no-cache',
    name => {
      const policies = SOURCES.flatMap(file => callPolicies(name, file));

      expect(policies.length).toBeGreaterThan(0);
      expect(policies.every(policy => policy === 'no-cache')).toBe(true);
    },
  );
});
