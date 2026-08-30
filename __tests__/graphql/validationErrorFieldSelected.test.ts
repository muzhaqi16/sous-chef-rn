/**
 * A mutation that CAN be refused by field must SELECT the field.
 *
 * The server names the refused input on `ValidationError.field`, and
 * `alertIfRejected` / `localizedRefusalMessage`
 * (`src/apollo/utils/alertRejectedMutation.ts`) turn that name into localized
 * copy from `errors.field.*`, falling back to the caller's own string. That is
 * the whole mechanism by which a refusal says something more useful than
 * "Failed to update item" — and the server's `message` is deliberately never
 * shown, because it is unlocalizable English by construction.
 *
 * The mechanism is reached only if the OPERATION selects `field`. Apollo hands
 * back what the document asked for, so a document that omits it drops the name
 * the server sent, `validationFieldName` returns null, and the localized branch
 * becomes unreachable — for every refusal, forever.
 *
 * Nothing else catches this. It type-checks (the generated union branch simply
 * lacks the field), it never errors (`defaultValue` degrades to copy that looks
 * correct), and no test notices unless its mock states `field` — which on an
 * operation that cannot return it is what the fixture-shape guard in
 * `apolloMockProvider` rejects. `RemoveItemsFromShoppingList` was found exactly
 * that way, by a mock that had been written for the behaviour the operation
 * could not deliver.
 *
 * Structural rather than behavioural on purpose: asserting the copy for one
 * refusal proves one refusal. Reading every document proves the class.
 *
 * The baseline is EMPTY — 155 of 155 comply — which makes this an invariant
 * rather than a worklist. It was 109 of 155; the other 46 were brought into
 * line rather than recorded as debt, because a shrink-only list of 46 is a list
 * nobody shrinks.
 */
import { readdirSync, readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import {
  buildSchema,
  isUnionType,
  parse,
  Kind,
  type FieldNode,
  type GraphQLSchema,
} from 'graphql';

const ROOT = resolve(__dirname, '..', '..');
const SRC = join(ROOT, 'src');

function graphqlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...graphqlFiles(full));
    else if (full.endsWith('.graphql')) out.push(full);
  }
  return out;
}

/** Mutations whose result union includes `ValidationError`, and whether they select its `field`. */
function auditMutations(schema: GraphQLSchema) {
  const mutationFields = schema.getMutationType()?.getFields() ?? {};
  const compliant: string[] = [];
  const missing: string[] = [];

  for (const file of graphqlFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    let document;
    try {
      document = parse(source);
    } catch {
      // A malformed document is `npm run lint`'s finding, not this test's.
      continue;
    }

    for (const definition of document.definitions) {
      if (
        definition.kind !== Kind.OPERATION_DEFINITION ||
        definition.operation !== 'mutation' ||
        !definition.name
      ) {
        continue;
      }
      const root = definition.selectionSet.selections.find(
        (selection): selection is FieldNode => selection.kind === Kind.FIELD,
      );
      if (!root?.selectionSet) continue;

      const schemaField = mutationFields[root.name.value];
      if (!schemaField) continue;
      let type = schemaField.type;
      while ('ofType' in type && type.ofType) type = type.ofType;
      if (!isUnionType(type)) continue;
      if (!type.getTypes().some(member => member.name === 'ValidationError')) {
        continue;
      }

      const selectsField = root.selectionSet.selections.some(
        selection =>
          selection.kind === Kind.INLINE_FRAGMENT &&
          selection.typeCondition?.name.value === 'ValidationError' &&
          selection.selectionSet.selections.some(
            sub => sub.kind === Kind.FIELD && sub.name.value === 'field',
          ),
      );

      const label = `${definition.name.value} (${relative(ROOT, file)})`;
      if (selectsField) compliant.push(label);
      else missing.push(label);
    }
  }

  return { compliant, missing };
}

describe('a refusable mutation selects ValidationError.field', () => {
  const schema = buildSchema(
    readFileSync(join(SRC, 'graphql/generated/schema.graphql'), 'utf8'),
  );
  const { compliant, missing } = auditMutations(schema);

  it('selects `field` on every mutation whose union can return a ValidationError', () => {
    expect(missing.sort()).toEqual([]);
  });

  it('is auditing a realistic number of mutations', () => {
    // The check above passes vacuously if the walk stops finding documents —
    // a moved directory, a parse regression, a schema without a Mutation type.
    // A floor makes "nothing to report" distinguishable from "nothing read".
    expect(compliant.length).toBeGreaterThanOrEqual(150);
  });
});
