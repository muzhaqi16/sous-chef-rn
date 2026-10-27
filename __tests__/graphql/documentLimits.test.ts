/**
 * Every document the app sends fits the limits the server measures a request
 * by. The server refuses a breach permanently — the same document is refused
 * every time — and the local dev API runs with looser overrides than the
 * defaults production takes, so only this test holds the real numbers.
 *
 * The server runs graphql-armor with a per-transport profile: HTTP gets depth
 * 10 / cost 3500, WebSocket gets depth 4 / cost 500. A subscription document is
 * not one request — the server re-executes it on every published event for the
 * life of the connection — so its budget is the tight one. A breach there is
 * refused at subscribe time with
 * `"Syntax Error: Query depth limit of 4 exceeded, found 6."`, per operation:
 * the socket stays open and one stream silently goes dead. Hence the thin-event
 * shape: subscribe to the envelope plus the identity of what changed, and read
 * the entity back through a normal query, which gets the HTTP budget.
 *
 * The counting rule: armor runs with `flattenFragments: true`, so a fragment,
 * inline or named, adds NO level and NO cost multiplier of its own — depth and
 * cost measure the data a document selects. A literal `first:`/`last:`
 * multiplies its whole subtree's cost by the page size; a VARIABLE does not,
 * which is why a page read states its size as one.
 *
 * Two caps bound the document itself: the parser refuses one over 2000 tokens
 * (400), over HTTP and on the WebSocket subscribe alike, and the request guard
 * one over 20 000 characters. Both are measured on the operation together with
 * every fragment sent with it, after the `__typename` Apollo adds to every
 * selection: the source text undercounts.
 *
 * One cap reads the REQUEST, not the document: the page sizes along one nested
 * path, variables resolved, multiply to at most 100 000
 * (`utils/graphql/paginationLimits.ts`). A page inside a page is the product of
 * both sizes, so a third level at the largest page does not fit.
 *
 * ---
 * The rules and their defaults are the API's:
 * `packages/core/src/config/armorConfig.ts` (the rules, `maxDocumentTokens()`),
 * `config/sections/http.ts` and `config/sections/publicApi.ts` (the defaults):
 *
 *     MAX_QUERY_DEPTH=10         MAX_QUERY_COST=3500     MAX_QUERY_LENGTH=20000
 *     MAX_QUERY_TOKENS=2000
 *     MAX_SUBSCRIPTION_DEPTH=4   MAX_SUBSCRIPTION_COMPLEXITY=500
 *     OBJECT_COST=1  SCALAR_COST=0  DEPTH_COST_FACTOR=1.5
 *     MAX_NESTED_PAGINATION_PRODUCT=100000
 *
 * `countDepth` / `computeCost` below are ports of
 * `@escape.tech/graphql-armor-max-depth` and `-cost-limit`. To re-derive them,
 * run the real rules over these documents — `validate(schema, doc, [rule])`
 * with `maxDepthRule` / `costLimitRule` from the API's `node_modules` — and
 * compare per operation.
 *
 * If the server's limits move, change the constants here — do not relax the
 * shape of the documents to match a number nobody checked.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, sep } from 'path';
import {
  parse,
  print,
  visit,
  Kind,
  Lexer,
  Source,
  TokenKind,
  type ASTNode,
  type DocumentNode,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
} from 'graphql';
import { addTypenameToDocument } from '@apollo/client/utilities';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import { OPERATION_ROOT_DIRS } from '#/test-utils/sourceRoots';

const SRC = resolve(__dirname, '..', '..', 'src');

// Server settings — see the docblock above. Two profiles, one per transport:
// HTTP is what a query or mutation is validated against, WebSocket what a
// subscription gets. Only the ceilings differ; the counting rule is identical,
// which is why one implementation checks both.
const MAX_SUBSCRIPTION_DEPTH = 4;
const MAX_SUBSCRIPTION_COST = 500;
const MAX_QUERY_DEPTH = 10;
const MAX_QUERY_COST = 3500;
const MAX_DOCUMENT_TOKENS = 2000;
const MAX_DOCUMENT_LENGTH = 20000;
const OBJECT_COST = 1;
const SCALAR_COST = 0;
const DEPTH_COST_FACTOR = 1.5;
const MAX_NESTED_PAGINATION_PRODUCT = 100000;

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

interface Operation {
  name: string;
  file: string;
  def: OperationDefinitionNode;
}

const fragments = new Map<string, FragmentDefinitionNode>();
const subscriptions: Operation[] = [];
const httpOperations: Operation[] = [];

for (const file of OPERATION_ROOT_DIRS.flatMap(dir =>
  collectGraphqlFiles(dir),
)) {
  let doc;
  try {
    doc = parse(readFileSync(file, 'utf8'));
  } catch {
    continue;
  }
  for (const def of doc.definitions) {
    if (def.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(def.name.value, def);
    } else if (def.kind === Kind.OPERATION_DEFINITION) {
      const operation: Operation = {
        name: def.name?.value ?? '(anonymous)',
        file: relative(resolve(SRC, '..'), file),
        def,
      };
      if (def.operation === 'subscription') subscriptions.push(operation);
      else httpOperations.push(operation);
    }
  }
}

const isFragment = (node: ASTNode) =>
  node.kind === Kind.INLINE_FRAGMENT || node.kind === Kind.FRAGMENT_SPREAD;

/** Port of `@escape.tech/graphql-armor-max-depth` with `flattenFragments: true`. */
function countDepth(
  node: ASTNode,
  parentDepth = 0,
  visited = new Map<string, number>(),
): number {
  let depth = parentDepth;
  const selectionSet = 'selectionSet' in node ? node.selectionSet : undefined;

  if (selectionSet) {
    for (const child of selectionSet.selections) {
      // A fragment is not a level: its fields sit at its parent's depth.
      const childDepth = isFragment(child) ? parentDepth : parentDepth + 1;
      depth = Math.max(depth, countDepth(child, childDepth, visited));
    }
  } else if (node.kind === Kind.FRAGMENT_SPREAD) {
    const name = node.name.value;
    if (visited.has(name)) return parentDepth + (visited.get(name) ?? 0);
    visited.set(name, -1);

    const fragment = fragments.get(name);
    if (fragment) {
      const fragmentDepth = countDepth(fragment, 0, visited);
      depth = Math.max(depth, parentDepth + fragmentDepth);
      if (visited.get(name) === -1) visited.set(name, fragmentDepth);
    }
  }
  return depth;
}

/** Port of `@escape.tech/graphql-armor-cost-limit` with `flattenFragments: true`. */
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
    // Pagination multiplier, for a LITERAL page size only. Only a field carries
    // `ArgumentNode`s; armor's `'arguments' in node` reaches the same set
    // through a looser check.
    let setMultiplier = 1;
    if (node.kind === Kind.FIELD && node.arguments) {
      for (const arg of node.arguments) {
        if (arg.name.value === 'first' || arg.name.value === 'last') {
          if (arg.value.kind === Kind.INT) {
            setMultiplier = Math.max(
              parseInt(arg.value.value) || 1,
              setMultiplier,
            );
          }
          break;
        }
      }
    }
    for (const child of selectionSet.selections) {
      // A fragment's cost is added as is; a field's is weighted by its level.
      cost += isFragment(child)
        ? computeCost(child, depth, visited)
        : DEPTH_COST_FACTOR * computeCost(child, depth + 1, visited);
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
      const fragmentCost = computeCost(fragment, depth, visited);
      cost += fragmentCost;
      if (visited.get(name) === -1) visited.set(name, fragmentCost);
    }
  }
  return cost;
}

const PAGE_ARGUMENTS = new Set(['limit', 'take', 'first', 'last']);

/**
 * Port of the path product in the API's `analyzeQueryStructure`
 * (`utils/graphql/queryAnalysis.ts`): the largest product of page sizes along
 * one nested path, with each variable at the value the app sends.
 */
function maxPageProduct(
  node: ASTNode,
  pageSizes: ReadonlyMap<string, number>,
  product = 1,
  open = new Set<string>(),
): number {
  let largest = product;
  const selectionSet = 'selectionSet' in node ? node.selectionSet : undefined;
  for (const child of selectionSet?.selections ?? []) {
    if (child.kind === Kind.FRAGMENT_SPREAD) {
      const name = child.name.value;
      const fragment = fragments.get(name);
      if (!fragment || open.has(name)) continue;
      open.add(name);
      largest = Math.max(
        largest,
        maxPageProduct(fragment, pageSizes, product, open),
      );
      open.delete(name);
      continue;
    }
    let pageSize = 1;
    if (child.kind === Kind.FIELD) {
      for (const arg of child.arguments ?? []) {
        if (!PAGE_ARGUMENTS.has(arg.name.value)) continue;
        const stated =
          arg.value.kind === Kind.INT
            ? parseInt(arg.value.value)
            : arg.value.kind === Kind.VARIABLE
            ? pageSizes.get(arg.value.name.value)
            : undefined;
        if (stated === undefined) {
          throw new Error(
            `${arg.name.value} on ${child.name.value} has no page size stated here`,
          );
        }
        pageSize = Math.max(pageSize, stated);
      }
    }
    largest = Math.max(
      largest,
      maxPageProduct(child, pageSizes, product * pageSize, open),
    );
  }
  return largest;
}

/** The operation as it is sent: itself and every fragment it reaches. */
function sentDocument(def: OperationDefinitionNode): string {
  const reached = new Map<string, FragmentDefinitionNode>();
  const collect = (node: ASTNode) => {
    visit(node, {
      FragmentSpread(spread) {
        const fragment = fragments.get(spread.name.value);
        if (fragment && !reached.has(spread.name.value)) {
          reached.set(spread.name.value, fragment);
          collect(fragment);
        }
      },
    });
  };
  collect(def);
  const document: DocumentNode = {
    kind: Kind.DOCUMENT,
    definitions: [def, ...reached.values()],
  };
  return print(addTypenameToDocument(document));
}

/** Tokens as the server's parser counts them (`parseOptions.maxTokens`). */
function countTokens(text: string): number {
  const lexer = new Lexer(new Source(text));
  let tokens = 0;
  while (lexer.advance().kind !== TokenKind.EOF) tokens += 1;
  return tokens;
}

describe('subscription document limits', () => {
  it('finds the subscription documents', () => {
    expect(subscriptions.length).toBeGreaterThan(0);
  });

  it.each(subscriptions.map(s => [s.name, s]))(
    '%s is within the subscription depth and cost bounds',
    (_name, sub) => {
      const { name, file, def } = sub;
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
            `${MAX_SUBSCRIPTION_DEPTH} at subscribe time. A fragment adds no level, ` +
            `so the fields under "node { ... on X }" sit at depth 3 and anything ` +
            `nested twice below them does not fit. Select the id and read the ` +
            `entity back through a query.`,
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

describe('HTTP document limits', () => {
  it('finds the query and mutation documents', () => {
    expect(httpOperations.length).toBeGreaterThan(100);
  });

  // GetMealPlan carries a fragment purely so a DERIVE can read it offline:
  // `useGenerateShoppingList_mealPlan` reaches an ingredient's item through the
  // plan's meals connection, which puts the document AT the depth limit. Both
  // page sizes, the plan's meals and each recipe's ingredients, are variables;
  // a literal `first: 100` on either would cost ~100× this.
  // Pinned so a widening of either is deliberate.
  it('GetMealPlan stays at the depth and cost the derive fragment was placed for', () => {
    const plan = httpOperations.find(o => o.name === 'GetMealPlan');
    expect(plan).toBeDefined();

    expect({
      depth: countDepth(plan!.def),
      cost: Math.round(computeCost(plan!.def)),
    }).toEqual({ depth: 10, cost: 234 });
  });

  // GetMealPlan pages each recipe's ingredients inside the page of meals: two
  // levels at the largest page. Pinned so a third paged level is deliberate.
  it('GetMealPlan nests its pages within the product the server allows', () => {
    const plan = httpOperations.find(o => o.name === 'GetMealPlan');
    expect(plan).toBeDefined();

    const product = maxPageProduct(
      plan!.def,
      new Map([
        ['mealsFirst', MEALS_PAGE_SIZE],
        ['ingredientsFirst', RECIPE_INGREDIENTS_PAGE_SIZE],
      ]),
    );

    expect(product).toBe(10000);
    expect(product).toBeLessThanOrEqual(MAX_NESTED_PAGINATION_PRODUCT);
  });

  it.each(httpOperations.map(o => [o.name, o]))(
    '%s is within the HTTP depth and cost bounds',
    (_name, operation) => {
      const { name, file, def } = operation;
      const depth = countDepth(def);
      const cost = computeCost(def);

      if (depth > MAX_QUERY_DEPTH) {
        throw new Error(
          `${name} (${file}) is depth ${depth}; the HTTP limit is ` +
            `${MAX_QUERY_DEPTH}. A connection costs two levels (edges, node), ` +
            `so a connection nested in a connection is the usual cause.`,
        );
      }
      if (cost > MAX_QUERY_COST) {
        throw new Error(
          `${name} (${file}) costs ${Math.round(cost)}; the HTTP limit is ` +
            `${MAX_QUERY_COST}. A LITERAL \`first:\`/\`last:\` multiplies its ` +
            `whole subtree by the page size, and every level above it multiplies ` +
            `by another ${DEPTH_COST_FACTOR}: state the page size as a variable.`,
        );
      }
    },
  );
});

describe('document size limits', () => {
  const operations = [...httpOperations, ...subscriptions];

  it.each(operations.map(o => [o.name, o]))(
    '%s fits the token and length caps with every fragment it sends',
    (_name, operation) => {
      const { name, file, def } = operation;
      const text = sentDocument(def);
      const tokens = countTokens(text);

      if (tokens > MAX_DOCUMENT_TOKENS) {
        throw new Error(
          `${name} (${file}) is ${tokens} tokens; the parser refuses a ` +
            `document over ${MAX_DOCUMENT_TOKENS}. Every fragment a mutation ` +
            `spreads is sent with it.`,
        );
      }
      if (text.length > MAX_DOCUMENT_LENGTH) {
        throw new Error(
          `${name} (${file}) is ${text.length} characters; the request ` +
            `guard refuses a query over ${MAX_DOCUMENT_LENGTH}.`,
        );
      }
    },
  );
});
