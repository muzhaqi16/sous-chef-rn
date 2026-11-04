import * as fs from 'node:fs';
import * as path from 'node:path';
import { costLimitRule } from '@escape.tech/graphql-armor-cost-limit';
import {
  buildSchema,
  Kind,
  Lexer,
  print,
  Source,
  TokenKind,
  validate,
  visit,
  type DocumentNode,
  type FragmentDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
import {
  ListFeedChangesDocument,
  ListFeedSnapshotDocument,
} from '#features/shoppingList/offline/listFeed.generated';
import {
  PantryFeedChangesDocument,
  PantryFeedSnapshotDocument,
} from '#features/pantry/offline/pantryFeed.generated';
import {
  HomeFeedChangesDocument,
  HomeFeedSnapshotDocument,
  HomeFeedSummaryDocument,
} from '#features/home/offline/homeFeed.generated';

/**
 * The feed's rows carry every field a list cell reads, so these documents grow
 * with the cells. Held to what the API refuses a document for: `armorConfig.ts`
 * and `config/sections/http.ts`. Cost is scored at 3000, what `.env.production`
 * sets, by the server's own rule. Nothing counts fields.
 */
const MAX_COST = 3000;
const MAX_DEPTH = 10;
const MAX_TOKENS = 2000;
const MAX_CHARACTERS = 20_000;
const MAX_ALIASES = 15;
const MAX_DIRECTIVES = 50;

const schema = buildSchema(
  fs.readFileSync(
    path.join(__dirname, '../../src/graphql/generated/schema.graphql'),
    'utf8',
  ),
);

/** The score the server's own rule gives; past the limit it gives none. */
function costOf(document: DocumentNode): number {
  let cost = Number.POSITIVE_INFINITY;
  validate(schema, document, [
    costLimitRule({
      maxCost: MAX_COST,
      objectCost: 1,
      scalarCost: 0,
      depthCostFactor: 1.5,
      ignoreIntrospection: true,
      flattenFragments: true,
      propagateOnRejection: false,
      onAccept: [
        (_context, { n }) => {
          cost = Number(n);
        },
      ],
    }),
  ]);
  return cost;
}

function tokensOf(text: string): number {
  const lexer = new Lexer(new Source(text));
  let count = 0;
  while (lexer.advance().kind !== TokenKind.EOF) count += 1;
  return count;
}

const fragmentsOf = (document: DocumentNode) =>
  new Map(
    document.definitions
      .filter(
        (definition): definition is FragmentDefinitionNode =>
          definition.kind === Kind.FRAGMENT_DEFINITION,
      )
      .map(fragment => [fragment.name.value, fragment]),
  );

function depthOf(document: DocumentNode): number {
  const fragments = fragmentsOf(document);
  const walk = (set: SelectionSetNode, depth: number): number =>
    Math.max(
      depth,
      ...set.selections.map(selection => {
        if (selection.kind === Kind.FIELD) {
          return selection.selectionSet
            ? walk(selection.selectionSet, depth + 1)
            : depth + 1;
        }
        const inner =
          selection.kind === Kind.INLINE_FRAGMENT
            ? selection.selectionSet
            : fragments.get(selection.name.value)?.selectionSet;
        return inner ? walk(inner, depth) : depth;
      }),
    );
  const [operation] = document.definitions;
  return operation?.kind === Kind.OPERATION_DEFINITION
    ? walk(operation.selectionSet, 0)
    : 0;
}

function countOf(document: DocumentNode, count: 'alias' | 'directive'): number {
  let total = 0;
  visit(document, {
    Field: node => {
      if (count === 'alias' && node.alias) total += 1;
    },
    Directive: () => {
      if (count === 'directive') total += 1;
    },
  });
  return total;
}

describe.each([
  ['a list pull', ListFeedChangesDocument],
  ['a list full read', ListFeedSnapshotDocument],
  ['a pantry pull', PantryFeedChangesDocument],
  ['a pantry full read', PantryFeedSnapshotDocument],
  ['a home pull', HomeFeedChangesDocument],
  ['a home full read', HomeFeedSnapshotDocument],
  ['a home summary', HomeFeedSummaryDocument],
])('%s', (_name, document) => {
  const text = print(document);

  it('stays under the cost the server refuses at', () => {
    expect(costOf(document)).toBeLessThan(MAX_COST);
  });

  it('stays under the structural limits', () => {
    expect(depthOf(document)).toBeLessThan(MAX_DEPTH);
    expect(tokensOf(text)).toBeLessThan(MAX_TOKENS);
    expect(text.length).toBeLessThan(MAX_CHARACTERS);
    expect(countOf(document, 'alias')).toBeLessThanOrEqual(MAX_ALIASES);
    expect(countOf(document, 'directive')).toBeLessThanOrEqual(MAX_DIRECTIVES);
  });
});
