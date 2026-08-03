/**
 * Guard the two schema invariants `classifyCreateResult` derives its answer
 * from, plus the operation-shape rule that keeps refusals visible.
 *
 * `src/apollo/utils/classifyCreateResult.ts` takes ONLY the mutation result. It
 * used to take the payload field name and the expected success `__typename` as
 * strings, neither checkable against the schema — and a stale one failed in the
 * worst direction, silently classifying every create as `'rejected'` and
 * reverting its optimistic write forever. Both arguments were removed because
 * both facts are derivable:
 *
 *   1. WHICH FIELD holds the payload — every mutation operation selects exactly
 *      one top-level field, so it's the single non-`__typename` entry in `data`.
 *   2. WHETHER THAT PAYLOAD IS SUCCESS — its `__typename` doesn't end in
 *      `Error`, because every mutation result union has exactly one non-`Error`
 *      member.
 *
 * Those are conventions, not things GraphQL enforces. Apollo's own errors-as-data
 * guidance recommends exactly this shape ("a single success type" plus error
 * types sharing an interface), and this API follows it — but a schema is free to
 * break it, and the failure would be silent at runtime. So they are asserted
 * here: if the API ever ships a result union with two payload members, or an
 * operation that selects two top-level fields, this test names the rule that
 * broke instead of letting creates quietly misclassify.
 *
 * The third assertion is the companion rule on the operation side: a mutation
 * selecting only the success arm of its union discards server refusals — the
 * error member arrives, matches no inline fragment, and the client sees an empty
 * payload it reads as success.
 *
 * Reads the generated SDL, so run `npm run codegen` first if the schema is stale.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, relative, sep } from 'path';
import {
  parse,
  Kind,
  type TypeNode,
  type DocumentNode,
  type UnionTypeDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
// The production rule itself, so this guards the code rather than a restatement
// of it that could be relaxed independently.
import { isErrorTypename } from '#/utils/errors/mutationPayload';

const SRC = resolve(__dirname, '..', '..', 'src');
const SCHEMA_PATH = join(SRC, 'graphql', 'generated', 'schema.graphql');

// --- Schema side ---

const schemaDoc: DocumentNode = parse(readFileSync(SCHEMA_PATH, 'utf8'), {
  noLocation: true,
});

/** Strips `!` and `[]` wrappers down to the named type. */
function namedType(type: TypeNode): string {
  if (type.kind === Kind.NON_NULL_TYPE || type.kind === Kind.LIST_TYPE) {
    return namedType(type.type);
  }
  return type.name.value;
}

const unions = new Map<string, UnionTypeDefinitionNode>();
/** Mutation field name → the named type it returns. */
const mutationReturns = new Map<string, string>();

for (const def of schemaDoc.definitions) {
  if (def.kind === Kind.UNION_TYPE_DEFINITION) {
    unions.set(def.name.value, def);
  } else if (
    def.kind === Kind.OBJECT_TYPE_DEFINITION &&
    def.name.value === 'Mutation'
  ) {
    for (const field of def.fields ?? []) {
      mutationReturns.set(field.name.value, namedType(field.type));
    }
  }
}

/** The union types actually returned by a mutation — not every union in the schema. */
const mutationResultUnions = [...new Set(mutationReturns.values())]
  .filter(name => unions.has(name))
  .sort();

// --- Operation side ---

function collectGraphqlFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    // Generated SDL is derived output, not an authored operation.
    if (full.includes(`graphql${sep}generated`)) continue;
    const st = statSync(full);
    if (st.isDirectory()) collectGraphqlFiles(full, out);
    else if (full.endsWith('.graphql')) out.push(full);
  }
  return out;
}

interface MutationOp {
  file: string;
  name: string;
  /** Top-level FIELD selections — the rule is that there is exactly one. */
  rootFields: { name: string; selectionSet?: SelectionSetNode }[];
}

const mutationOps: MutationOp[] = [];
for (const file of collectGraphqlFiles(SRC)) {
  let doc: DocumentNode;
  try {
    doc = parse(readFileSync(file, 'utf8'), { noLocation: true });
  } catch {
    continue;
  }
  for (const def of doc.definitions) {
    if (
      def.kind !== Kind.OPERATION_DEFINITION ||
      def.operation !== 'mutation'
    ) {
      continue;
    }
    mutationOps.push({
      file: relative(SRC, file),
      name: def.name?.value ?? '(anonymous)',
      rootFields: def.selectionSet.selections
        .filter(s => s.kind === Kind.FIELD)
        .map(s => ({ name: s.name.value, selectionSet: s.selectionSet })),
    });
  }
}

/** Type conditions of the inline fragments directly inside a selection set. */
function inlineArms(selSet: SelectionSetNode | undefined): string[] {
  if (!selSet) return [];
  return selSet.selections
    .filter(s => s.kind === Kind.INLINE_FRAGMENT)
    .map(s => s.typeCondition?.name.value)
    .filter((n): n is string => Boolean(n));
}

const fmt = (lines: string[]) => lines.map(l => `  • ${l}`).join('\n');

describe('mutation result invariants', () => {
  it('every mutation result union has exactly one non-Error member', () => {
    const violations = mutationResultUnions
      .map(name => {
        const members = (unions.get(name)?.types ?? []).map(t => t.name.value);
        const payloads = members.filter(m => !isErrorTypename(m));
        return { name, payloads };
      })
      .filter(u => u.payloads.length !== 1)
      .map(u => `${u.name} → ${u.payloads.length} non-Error members: ${
        u.payloads.join(', ') || '(none)'
      }`);

    if (violations.length > 0) {
      throw new Error(
        `${violations.length} mutation result union(s) break the single-success-member rule.\n` +
          `classifyCreateResult treats "__typename does not end in Error" as success, so a union ` +
          `with two payload members would classify the wrong one as the create's result, and one ` +
          `with none would classify every outcome as a refusal. Either restore the convention in ` +
          `the API, or give classifyCreateResult an explicit success typename again for these:\n` +
          fmt(violations),
      );
    }
    expect(violations).toEqual([]);
  });

  it('every mutation operation selects exactly one top-level field', () => {
    const violations = mutationOps
      .filter(op => op.rootFields.length !== 1)
      .map(
        op =>
          `${op.name} (${op.file}) → ${op.rootFields.length} top-level fields: ${
            op.rootFields.map(f => f.name).join(', ') || '(none)'
          }`,
      );

    if (violations.length > 0) {
      throw new Error(
        `${violations.length} mutation operation(s) select more than one top-level field.\n` +
          `classifyCreateResult locates the payload as the single non-__typename entry in ` +
          `\`data\`; with two, it can't tell which one carries the outcome and reports 'queued'. ` +
          `Split these into separate operations:\n` + fmt(violations),
      );
    }
    expect(violations).toEqual([]);
  });

  it('every mutation that selects union arms also selects an Error arm', () => {
    const violations: string[] = [];
    for (const op of mutationOps) {
      for (const field of op.rootFields) {
        const returns = mutationReturns.get(field.name);
        // Unknown field = schema drift; `npm run lint` reports that separately.
        if (!returns || !unions.has(returns)) continue;
        const arms = inlineArms(field.selectionSet);
        // No arms at all means nothing but __typename is selected — the payload
        // carries no data either way, so there is nothing to swallow.
        if (arms.length === 0) continue;
        if (!arms.some(isErrorTypename)) {
          violations.push(
            `${op.name} (${op.file}) → ${field.name}: ${returns} arms [${arms.join(', ')}]`,
          );
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `${violations.length} mutation selection(s) omit an error arm.\n` +
          `A server refusal is a union member: with no \`... on Error\` (or a specific ` +
          `\`*Error\`) arm it matches nothing, arrives as an all-but-empty payload, and the ` +
          `client reads the refusal as success. Add an error arm to each:\n` + fmt(violations),
      );
    }
    expect(violations).toEqual([]);
  });

  it('found a schema and operations to validate (sanity)', () => {
    expect(mutationReturns.size).toBeGreaterThan(0);
    expect(mutationResultUnions.length).toBeGreaterThan(0);
    expect(mutationOps.length).toBeGreaterThan(0);
  });
});
