/**
 * Subscription documents are validated far more tightly than HTTP operations.
 *
 * The server runs graphql-armor with a per-transport profile: HTTP gets depth
 * 12 / cost 3000, WebSocket gets depth 5 / cost 500. The reason is that a
 * subscription document is not one request — the server re-executes it on every
 * published event for the life of the connection, so a fat selection is a
 * standing cost rather than a one-time one.
 *
 * A breach is refused at subscribe time with
 * `"Syntax Error: Query depth limit of 5 exceeded, found 8."` — worded as a
 * syntax error, though the document parses fine and `found N` is its computed
 * depth. The rejection is permanent (the same document is refused every time)
 * and it is per-operation: the socket stays open and its other subscriptions
 * keep delivering, so it surfaces as one stream silently going dead rather than
 * as a connection failure. That is why it needs a test.
 *
 * The counting rule is the part worth knowing, because it is not the one most
 * people assume. Armor runs with `flattenFragments: false`, so:
 *
 *   - an INLINE fragment (`... on X`) counts as a depth level, and
 *   - a NAMED spread (`...Frag`) counts as a level PLUS the fragment's own
 *     internal depth.
 *
 * `node { ... on PantryItem { id } }` is therefore already depth 4, and any
 * named spread inside a `node` branch cannot fit under 5 no matter how small
 * the fragment is. Hence the thin-event shape: subscribe to the envelope plus
 * the identity of what changed, and read the entity back through a normal
 * query, which gets the HTTP budget.
 *
 * ---
 * Verified 2026-08 against `@escape.tech/graphql-armor-max-depth@2.4.2` and
 * `@escape.tech/graphql-armor-cost-limit`, as configured by the API's
 * `packages/core/src/config/armorConfig.ts` with the defaults in
 * `packages/core/src/config/env.ts`:
 *
 *     MAX_SUBSCRIPTION_DEPTH=5   MAX_SUBSCRIPTION_COMPLEXITY=500
 *     OBJECT_COST=1  SCALAR_COST=0  DEPTH_COST_FACTOR=1.5
 *
 * `countDepth` / `computeCost` below are ports of those two rules. To re-derive
 * them, run the real rules over these documents:
 *
 *     node -e "…" # import maxDepthRule/costLimitRule from the API's
 *                 # node_modules and validate(schema, doc, [rule])
 *
 * If the server's limits move, change the constants here — do not relax the
 * shape of the documents to match a number nobody checked.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, sep } from 'path';
import {
  parse,
  Kind,
  type ASTNode,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
} from 'graphql';

const SRC = resolve(__dirname, '..', '..', 'src');

// Server settings — see the docblock above.
const MAX_SUBSCRIPTION_DEPTH = 5;
const MAX_SUBSCRIPTION_COST = 500;
const OBJECT_COST = 1;
const SCALAR_COST = 0;
const DEPTH_COST_FACTOR = 1.5;

function collectGraphqlFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (full.includes(`graphql${sep}generated`)) continue;
    const st = statSync(full);
    if (st.isDirectory()) collectGraphqlFiles(full, out);
    else if (full.endsWith('.graphql')) out.push(full);
  }
  return out;
}

const fragments = new Map<string, FragmentDefinitionNode>();
const subscriptions: { name: string; file: string; def: OperationDefinitionNode }[] =
  [];

for (const file of collectGraphqlFiles(SRC)) {
  let doc;
  try {
    doc = parse(readFileSync(file, 'utf8'));
  } catch {
    continue;
  }
  for (const def of doc.definitions) {
    if (def.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(def.name.value, def);
    } else if (
      def.kind === Kind.OPERATION_DEFINITION &&
      def.operation === 'subscription'
    ) {
      subscriptions.push({
        name: def.name?.value ?? '(anonymous)',
        file: file.slice(SRC.length + 1),
        def,
      });
    }
  }
}

/** Port of `@escape.tech/graphql-armor-max-depth` with `flattenFragments: false`. */
function countDepth(
  node: ASTNode,
  parentDepth = 0,
  visited = new Map<string, number>(),
): number {
  let depth = parentDepth;
  const selectionSet = 'selectionSet' in node ? node.selectionSet : undefined;

  if (selectionSet) {
    for (const child of selectionSet.selections) {
      depth = Math.max(depth, countDepth(child, parentDepth + 1, visited));
    }
  } else if (node.kind === Kind.FRAGMENT_SPREAD) {
    const spreadDepth = parentDepth + 1;
    const name = node.name.value;
    if (visited.has(name)) return spreadDepth + (visited.get(name) ?? 0);
    visited.set(name, -1);

    const fragment = fragments.get(name);
    if (fragment) {
      const fragmentDepth = countDepth(fragment, 0, visited);
      depth = Math.max(depth, spreadDepth + fragmentDepth);
      if (visited.get(name) === -1) visited.set(name, fragmentDepth);
    }
  }
  return depth;
}

/** Port of `@escape.tech/graphql-armor-cost-limit` with `flattenFragments: false`. */
function computeCost(
  node: ASTNode,
  depth = 0,
  visited = new Map<string, number>(),
): number {
  if (node.kind === Kind.OPERATION_DEFINITION) {
    return node.selectionSet.selections.reduce(
      (total, child) => total + computeCost(child, depth + 1, visited),
      0,
    );
  }

  let cost: number = SCALAR_COST;
  const selectionSet = 'selectionSet' in node ? node.selectionSet : undefined;

  if (selectionSet) {
    cost = OBJECT_COST;
    // Pagination multiplier. Only a field carries `ArgumentNode`s; armor's
    // `'arguments' in node` reaches the same set through a looser check.
    let setMultiplier = 1;
    if (node.kind === Kind.FIELD && node.arguments) {
      for (const arg of node.arguments) {
        if (arg.name.value === 'first' || arg.name.value === 'last') {
          if (arg.value.kind === Kind.INT) {
            setMultiplier = Math.max(
              parseInt(arg.value.value, 10) || 1,
              setMultiplier,
            );
          }
          break;
        }
      }
    }
    for (const child of selectionSet.selections) {
      cost += DEPTH_COST_FACTOR * computeCost(child, depth + 1, visited);
    }
    cost *= setMultiplier;
  } else if (node.kind === Kind.FRAGMENT_SPREAD) {
    const name = node.name.value;
    if (visited.has(name)) {
      return cost + DEPTH_COST_FACTOR * (visited.get(name) ?? 0);
    }
    visited.set(name, -1);

    const fragment = fragments.get(name);
    if (fragment) {
      const fragmentCost = computeCost(fragment, depth + 1, visited);
      cost += DEPTH_COST_FACTOR * fragmentCost;
      if (visited.get(name) === -1) visited.set(name, fragmentCost);
    }
  }
  return cost;
}

describe('subscription document limits', () => {
  it('finds the subscription documents', () => {
    expect(subscriptions.length).toBeGreaterThan(0);
  });

  it.each(subscriptions.map(s => [s.name, s]))(
    '%s is within the subscription depth and cost bounds',
    (_name, sub) => {
      const { name, file, def } = sub as (typeof subscriptions)[number];
      const depth = countDepth(def);
      const cost = computeCost(def);

      expect({ name, depth, cost: Math.round(cost) }).toEqual({
        name,
        depth: expect.any(Number),
        cost: expect.any(Number),
      });

      if (depth > MAX_SUBSCRIPTION_DEPTH) {
        throw new Error(
          `${name} (${file}) is depth ${depth}; the server refuses anything over ` +
            `${MAX_SUBSCRIPTION_DEPTH} at subscribe time. Remember an inline ` +
            `fragment counts as a level and a named spread counts as a level plus ` +
            `the fragment's own depth — so a spread inside "node { ... on X }" ` +
            `never fits. Select the id and read the entity back through a query.`,
        );
      }
      if (cost > MAX_SUBSCRIPTION_COST) {
        throw new Error(
          `${name} (${file}) costs ${Math.round(cost)}; the limit is ` +
            `${MAX_SUBSCRIPTION_COST}. Cost grows by ${DEPTH_COST_FACTOR}× per ` +
            `level, so trimming depth is what brings it down.`,
        );
      }
    },
  );
});
