/**
 * `<Type>Readers`: the union of what the app's queries read on an entity, for a
 * mutation that changes one to spread (Relay's rule). Spreads are flattened so
 * no consumer fragment's connections come along; connections and views are
 * excluded, conflicting arguments aliased, and a variable argument renamed to
 * the argument's own name for the spreading operation to declare.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getNamedType,
  isAbstractType,
  isObjectType,
  Kind,
  print,
} from 'graphql';
import { filesUnder, fromRoot } from './tooling.mjs';
import { isEntity, isOwnedElsewhere } from './graphqlDocuments.mjs';

/** Where a documents tree keeps its generated readers. */
export const readersDirOf = root => join(root, 'graphql', 'readers');
export const READERS_DIR = readersDirOf(fromRoot('src'));
const SUFFIX = 'Readers';

const readersFile = (type, dir) =>
  join(dir, `${type[0].toLowerCase()}${type.slice(1)}${SUFFIX}.graphql`);

// A selection tree: Map<type condition, Map<key, { name, args, sub }>>, where
// the key is the field name plus its printed arguments.
const newTree = () => new Map();

function normalizeArguments(field, args, where) {
  return (args ?? [])
    .map(arg => {
      if (arg.value.kind === Kind.VARIABLE) {
        return {
          ...arg,
          value: { kind: Kind.VARIABLE, name: arg.name },
        };
      }
      if (JSON.stringify(arg.value).includes('"Variable"')) {
        throw new Error(
          `${where}: ${field.name}(${arg.name.value}:) nests a variable inside ` +
            'a value; a readers fragment cannot carry it',
        );
      }
      return arg;
    })
    .sort((a, b) => a.name.value.localeCompare(b.name.value));
}

function addSelections(
  schema,
  tree,
  parentType,
  selectionSet,
  fragments,
  seen,
) {
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const name = selection.name.value;
      const fragment = fragments.get(name);
      if (!fragment || seen.has(name)) continue;
      addSelections(
        schema,
        tree,
        schema.getType(fragment.typeCondition.name.value),
        fragment.selectionSet,
        fragments,
        new Set(seen).add(name),
      );
      continue;
    }
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      const condition = selection.typeCondition
        ? schema.getType(selection.typeCondition.name.value)
        : parentType;
      addSelections(
        schema,
        tree,
        condition,
        selection.selectionSet,
        fragments,
        seen,
      );
      continue;
    }
    const name = selection.name.value;
    if (name === '__typename') continue;
    const field = parentType.getFields()[name];
    if (!field || isOwnedElsewhere(parentType, field)) continue;
    const args = normalizeArguments(
      field,
      selection.arguments,
      parentType.name,
    );
    const key = `${name}(${args.map(print).join(', ')})`;
    const group = tree.get(parentType.name) ?? new Map();
    tree.set(parentType.name, group);
    const entry = group.get(key) ?? { name, args, sub: null };
    group.set(key, entry);
    if (selection.selectionSet) {
      entry.sub ??= newTree();
      addSelections(
        schema,
        entry.sub,
        getNamedType(field.type),
        selection.selectionSet,
        fragments,
        seen,
      );
    }
  }
}

function mergeTree(into, from) {
  for (const [condition, group] of from) {
    const target = into.get(condition) ?? new Map();
    into.set(condition, target);
    for (const [key, entry] of group) {
      const existing = target.get(key);
      if (!existing) {
        target.set(key, {
          ...entry,
          sub: entry.sub && mergeTree(newTree(), entry.sub),
        });
      } else if (entry.sub) {
        existing.sub = mergeTree(existing.sub ?? newTree(), entry.sub);
      }
    }
  }
  return into;
}

/** Per entity type, the union of what every query reads on it. */
export function computeReaders(schema, { fragments, operations }) {
  const readers = new Map();
  const record = (type, tree) =>
    readers.set(type, mergeTree(readers.get(type) ?? newTree(), tree));

  const walk = (parentType, selectionSet, seen) => {
    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const name = selection.name.value;
        const fragment = fragments.get(name);
        if (!fragment || seen.has(name)) continue;
        walk(
          schema.getType(fragment.typeCondition.name.value),
          fragment.selectionSet,
          new Set(seen).add(name),
        );
        continue;
      }
      if (selection.kind === Kind.INLINE_FRAGMENT) {
        const condition = selection.typeCondition
          ? schema.getType(selection.typeCondition.name.value)
          : parentType;
        walk(condition, selection.selectionSet, seen);
        continue;
      }
      if (!selection.selectionSet) continue;
      const field = parentType.getFields()[selection.name.value];
      if (!field) continue;
      const type = getNamedType(field.type);
      // A connection or view is not owed, but the entities inside it are read.
      if (isEntity(type) && !isOwnedElsewhere(parentType, field)) {
        const occurrence = newTree();
        addSelections(
          schema,
          occurrence,
          type,
          selection.selectionSet,
          fragments,
          seen,
        );
        record(type.name, occurrence);
        // Reached through an interface or union: each concrete entity type
        // also owes what was read on it and on the abstract type.
        if (isAbstractType(type)) {
          for (const [condition, group] of occurrence) {
            const concrete = schema.getType(condition);
            if (
              condition === type.name ||
              !isObjectType(concrete) ||
              !isEntity(concrete)
            )
              continue;
            const own = new Map([[condition, group]]);
            const shared = occurrence.get(type.name);
            if (shared) own.set(condition, new Map([...shared, ...group]));
            record(condition, own);
          }
        }
      }
      walk(type, selection.selectionSet, seen);
    }
  };

  for (const operation of operations) {
    if (operation.kind !== 'query') continue;
    walk(schema.getQueryType(), operation.ast.selectionSet, new Set());
  }
  return readers;
}

/** The entity types some document spreads `...<Type>Readers` on. */
export function readersDemand(schema, { fragments, operations }) {
  const demanded = new Set();
  const scan = node => {
    if (!node || typeof node !== 'object') return;
    if (
      node.kind === Kind.FRAGMENT_SPREAD &&
      node.name.value.endsWith(SUFFIX)
    ) {
      const type = node.name.value.slice(0, -SUFFIX.length);
      if (!isEntity(schema.getType(type))) {
        throw new Error(`...${node.name.value} names no entity type '${type}'`);
      }
      demanded.add(type);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc') continue;
      if (Array.isArray(value)) value.forEach(scan);
      else if (value && typeof value === 'object') scan(value);
    }
  };
  for (const operation of operations) scan(operation.ast);
  for (const [name, fragment] of fragments) {
    if (!name.endsWith(SUFFIX)) scan(fragment);
  }
  return demanded;
}

function toSelectionSet(schema, tree, type, variables) {
  const selections = [];
  const conditions = [...tree.keys()].sort((a, b) =>
    a === type.name ? -1 : b === type.name ? 1 : a.localeCompare(b),
  );
  for (const condition of conditions) {
    const conditionType = schema.getType(condition);
    const entries = [...tree.get(condition).entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const taken = new Map();
    const fields = entries.map(([, entry]) => {
      const field = conditionType.getFields()[entry.name];
      for (const arg of entry.args) {
        if (arg.value.kind !== Kind.VARIABLE) continue;
        const declared = String(
          field.args.find(a => a.name === arg.name.value).type,
        );
        const previous = variables.get(arg.name.value);
        if (previous && previous !== declared) {
          throw new Error(
            `$${arg.name.value} is needed as both ${previous} and ${declared}`,
          );
        }
        variables.set(arg.name.value, declared);
      }
      const seenCount = (taken.get(entry.name) ?? 0) + 1;
      taken.set(entry.name, seenCount);
      return {
        kind: Kind.FIELD,
        alias:
          seenCount > 1
            ? { kind: Kind.NAME, value: `${entry.name}_${seenCount}` }
            : undefined,
        name: { kind: Kind.NAME, value: entry.name },
        arguments: entry.args,
        selectionSet: entry.sub
          ? toSelectionSet(
              schema,
              entry.sub,
              getNamedType(field.type),
              variables,
            )
          : undefined,
      };
    });
    const withKey =
      isEntity(conditionType) && !fields.some(f => f.name.value === 'id')
        ? [
            { kind: Kind.FIELD, name: { kind: Kind.NAME, value: 'id' } },
            ...fields,
          ]
        : fields;
    const ordered = [
      ...withKey.filter(f => f.name.value === 'id' && !f.alias),
      ...withKey.filter(f => !(f.name.value === 'id' && !f.alias)),
    ];
    if (condition === type.name) {
      selections.push(...ordered);
    } else {
      selections.push({
        kind: Kind.INLINE_FRAGMENT,
        typeCondition: {
          kind: Kind.NAMED_TYPE,
          name: { kind: Kind.NAME, value: condition },
        },
        selectionSet: { kind: Kind.SELECTION_SET, selections: ordered },
      });
    }
  }
  return { kind: Kind.SELECTION_SET, selections };
}

function renderReaders(schema, type, tree) {
  const variables = new Map();
  const fragment = {
    kind: Kind.FRAGMENT_DEFINITION,
    name: { kind: Kind.NAME, value: `${type}${SUFFIX}` },
    typeCondition: {
      kind: Kind.NAMED_TYPE,
      name: { kind: Kind.NAME, value: type },
    },
    selectionSet: toSelectionSet(schema, tree, schema.getType(type), variables),
  };
  return `# Generated by scripts/generate-readers-fragments.mjs. Do not edit.\n${print(
    fragment,
  )}\n`;
}

/** Every readers file that should exist, by path, with its contents. */
export function expectedReadersFiles(schema, documents, dir = READERS_DIR) {
  const readers = computeReaders(schema, documents);
  const files = new Map();
  for (const type of [...readersDemand(schema, documents)].sort()) {
    const tree = readers.get(type);
    if (!tree) {
      throw new Error(
        `...${type}${SUFFIX} is spread, but no query reads ${type}: there is ` +
          'nothing for a mutation to keep current',
      );
    }
    files.set(readersFile(type, dir), renderReaders(schema, type, tree));
  }
  return files;
}

/** Readers files that are missing, out of date, or no longer spread. */
export function staleReadersFiles(schema, documents, dir = READERS_DIR) {
  const expected = expectedReadersFiles(schema, documents, dir);
  const stale = [];
  for (const [path, text] of expected) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== text)
      stale.push(path);
  }
  const present = existsSync(dir) ? filesUnder('*.graphql', { cwd: dir }) : [];
  for (const path of present) {
    if (!expected.has(path)) stale.push(path);
  }
  return { expected, stale };
}
