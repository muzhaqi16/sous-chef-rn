/**
 * The schema, documents and exclusion rule shared by the cache-coverage
 * scripts, so the check and the readers generator cannot disagree.
 */
import { existsSync, readFileSync } from 'node:fs';
import {
  buildSchema,
  getNamedType,
  isInterfaceType,
  isObjectType,
  parse,
} from 'graphql';
import { filesUnder, fromRoot } from './tooling.mjs';

export const SCHEMA_PATH = fromRoot(
  'src',
  'graphql',
  'generated',
  'schema.graphql',
);

/** `id` is every type's cache key (no type policy overrides `keyFields`). */
export const KEY_FIELDS = new Set(['id', '__typename']);

// Resolving types from the schema is what lets nested selections count: a
// field selected inline under a nested object is otherwise invisible.
export function loadSchema(check) {
  if (!existsSync(SCHEMA_PATH)) {
    console.error(
      `✗ ${check}: no schema at ${SCHEMA_PATH}. Run \`npm run codegen\` first.`,
    );
    process.exit(2);
  }
  return buildSchema(readFileSync(SCHEMA_PATH, 'utf8'));
}

/** Every fragment (by name) and operation under `src/`, tests excluded. */
export function loadDocuments() {
  const files = filesUnder('src/**/*.graphql', {
    exclude: [/(^|\/)(generated|__tests__)(\/|$)/],
  });
  const fragments = new Map();
  const operations = [];
  for (const file of files) {
    for (const definition of parse(readFileSync(file, 'utf8')).definitions) {
      if (definition.kind === 'FragmentDefinition') {
        fragments.set(definition.name.value, definition);
      } else if (definition.kind === 'OperationDefinition') {
        operations.push({
          kind: definition.operation,
          name: definition.name?.value ?? '(anonymous)',
          ast: definition,
          file,
        });
      }
    }
  }
  return { fragments, operations };
}

/** A type Apollo normalizes, so a response can leave a stale copy of it. */
export const isEntity = type =>
  (isObjectType(type) || isInterfaceType(type)) && 'id' in type.getFields();

/**
 * A field no mutation owes: a connection, kept current by its edge writers
 * (`connection-field-integrity`) since returning a page would replace the list
 * a screen holds; a computed view (analytics, suggestions) its own screen
 * recomputes on every mount; or a field one writer owns, which a mutation's
 * snapshot would race.
 */
const VIEWS = /Analytics$|^suggestions$/;
const OWNED_BY_WRITER = new Set([
  // Follows the given pantry's stacks, which pantry writes change; read only by
  // the barcode lookup, under its own route's pantry.
  'Item.trackingUnit',
]);
export const isOwnedElsewhere = (parentType, field) =>
  /Connection$/.test(getNamedType(field.type).name) ||
  VIEWS.test(field.name) ||
  OWNED_BY_WRITER.has(`${parentType.name}.${field.name}`);
