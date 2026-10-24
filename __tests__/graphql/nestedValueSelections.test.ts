import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildSchema,
  getNamedType,
  isAbstractType,
  isObjectType,
  Kind,
  parse,
  type FieldNode,
  type FragmentDefinitionNode,
  type GraphQLObjectType,
  type GraphQLSchema,
  type OperationDefinitionNode,
  type SelectionNode,
} from 'graphql';
import type { TypePolicies } from '@apollo/client';
import { mergeTypePolicies } from '#/apollo/cache';
import { FEATURE_TYPE_POLICIES } from '#features/registry.cache';
import { OPERATION_ROOT_DIRS } from '#/test-utils/sourceRoots';

/**
 * Apollo REPLACES a value with no id on write. When one document selects part
 * of an entity's nested value and another selects all of it, the narrow write
 * strips the rest, and a strict reader of the whole value — the pantry item
 * detail over `PantryItem.image` — reads incomplete and blanks. So every
 * selection of such a field carries the same fields, or the cache states a
 * merge for it. Read-only fragments are held too: the scan cannot tell a reader
 * from a writer.
 */
const ROOT = path.join(__dirname, '..', '..');

type Definition = OperationDefinitionNode | FragmentDefinitionNode;

/** Each entity field holding a value with no id: its value type and every shape selected on it. */
type NestedValueShapes = Map<
  string,
  { valueType: string; shapes: Set<string> }
>;

const hasId = (type: GraphQLObjectType) => 'id' in type.getFields();

export function nestedValueShapes(
  schema: GraphQLSchema,
  definitions: readonly Definition[],
): NestedValueShapes {
  const fragments = new Map(
    definitions
      .filter(
        (d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION,
      )
      .map(d => [d.name.value, d]),
  );

  const appliesTo = (
    condition: string | undefined,
    type: GraphQLObjectType,
  ) => {
    if (!condition || condition === type.name) return true;
    const conditionType = schema.getType(condition);
    return (
      !!conditionType &&
      isAbstractType(conditionType) &&
      schema.isSubType(conditionType, type)
    );
  };

  /** The fields `selections` picks on `type`, by name, through spreads and inline fragments. */
  const fieldsOf = (
    selections: readonly SelectionNode[],
    type: GraphQLObjectType,
  ): Map<string, FieldNode[]> => {
    const out = new Map<string, FieldNode[]>();
    const add = (node: FieldNode) => {
      out.set(node.name.value, [...(out.get(node.name.value) ?? []), node]);
    };
    const collect = (nodes: readonly SelectionNode[]) => {
      for (const node of nodes) {
        if (node.kind === Kind.FIELD) add(node);
        else if (node.kind === Kind.INLINE_FRAGMENT) {
          if (appliesTo(node.typeCondition?.name.value, type)) {
            collect(node.selectionSet.selections);
          }
        } else {
          const fragment = fragments.get(node.name.value);
          if (fragment && appliesTo(fragment.typeCondition.name.value, type)) {
            collect(fragment.selectionSet.selections);
          }
        }
      }
    };
    collect(selections);
    return out;
  };

  const subSelections = (nodes: FieldNode[]) =>
    nodes.flatMap(node => node.selectionSet?.selections ?? []);

  const fieldType = (type: GraphQLObjectType, field: string) =>
    getNamedType(type.getFields()[field]?.type);

  /** The field's value when it is an object with no id of its own. */
  const nestedValueType = (type: GraphQLObjectType, field: string) => {
    const value = fieldType(type, field);
    return isObjectType(value) && !hasId(value) ? value : null;
  };

  /** Each concrete type a field's value can be. */
  const typesUnder = (type: GraphQLObjectType, field: string) => {
    const value = fieldType(type, field);
    if (isObjectType(value)) return [value];
    return value && isAbstractType(value) ? schema.getPossibleTypes(value) : [];
  };

  // An entity under the value is normalized, so only its presence counts.
  const shapeOf = (nodes: FieldNode[], type: GraphQLObjectType): string =>
    [...fieldsOf(subSelections(nodes), type)]
      .filter(([name]) => name !== '__typename')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, sub]) => {
        const value = nestedValueType(type, name);
        return value ? `${name} { ${shapeOf(sub, value)} }` : name;
      })
      .join(' ');

  const shapes: NestedValueShapes = new Map();
  const walk = (
    selections: readonly SelectionNode[],
    type: GraphQLObjectType,
  ) => {
    for (const [name, nodes] of fieldsOf(selections, type)) {
      const value = nestedValueType(type, name);
      if (value && hasId(type)) {
        const key = `${type.name}.${name}`;
        const entry = shapes.get(key) ?? {
          valueType: value.name,
          shapes: new Set<string>(),
        };
        entry.shapes.add(shapeOf(nodes, value));
        shapes.set(key, entry);
      }
      for (const child of typesUnder(type, name)) {
        walk(subSelections(nodes), child);
      }
    }
  };

  for (const definition of definitions) {
    const root =
      definition.kind === Kind.FRAGMENT_DEFINITION
        ? schema.getType(definition.typeCondition.name.value)
        : schema.getRootType(definition.operation);
    if (isObjectType(root)) walk(definition.selectionSet.selections, root);
    else if (root && isAbstractType(root)) {
      for (const type of schema.getPossibleTypes(root)) {
        walk(definition.selectionSet.selections, type);
      }
    }
  }
  return shapes;
}

/** Each field selected in several shapes with no merge stated for it or its value type. */
export function unmergedSplitSelections(
  shapes: NestedValueShapes,
  policies: TypePolicies,
): string[] {
  return [...shapes]
    .filter(([key, { valueType, shapes: selected }]) => {
      if (selected.size < 2) return false;
      const [parent = '', field = ''] = key.split('.');
      const fieldPolicy = policies[parent]?.fields?.[field];
      const fieldMerges =
        typeof fieldPolicy === 'object' && 'merge' in fieldPolicy;
      return !fieldMerges && policies[valueType]?.merge === undefined;
    })
    .map(
      ([key, { shapes: selected }]) =>
        `${key}: ${[...selected]
          .sort()
          .map(s => `{ ${s} }`)
          .join(' | ')}`,
    );
}

const filesUnder = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return ['generated', '__tests__', '__mocks__'].includes(entry.name)
        ? []
        : filesUnder(full);
    }
    return entry.name.endsWith('.graphql') ? [full] : [];
  });

const definitionsIn = (source: string): Definition[] =>
  parse(source).definitions.filter(
    (d): d is Definition =>
      d.kind === Kind.OPERATION_DEFINITION ||
      d.kind === Kind.FRAGMENT_DEFINITION,
  );

const schema = buildSchema(
  fs.readFileSync(
    path.join(ROOT, 'src/graphql/generated/schema.graphql'),
    'utf8',
  ),
);
const definitions = OPERATION_ROOT_DIRS.flatMap(filesUnder).flatMap(file =>
  definitionsIn(fs.readFileSync(file, 'utf8')),
);

describe('nested value selections', () => {
  const shapes = nestedValueShapes(schema, definitions);

  it('reads the documents it judges', () => {
    expect(definitions.length).toBeGreaterThan(200);
    expect(shapes.size).toBeGreaterThan(20);
  });

  it('selects each entity nested value in one shape, or states a merge for it', () => {
    expect(
      unmergedSplitSelections(shapes, mergeTypePolicies(FEATURE_TYPE_POLICIES)),
    ).toEqual([]);
  });

  describe('the check itself', () => {
    const synthetic = buildSchema(`
      type Query { item: Item }
      type Item { id: ID! image: Image unit: Unit }
      type Image { url: String! ref: ID credit: Credit }
      type Credit { author: String license: String }
      type Unit { id: ID! name: String symbol: String }
    `);
    const split = nestedValueShapes(synthetic, [
      ...definitionsIn('query List { item { id image { url } unit { id } } }'),
      ...definitionsIn(
        'fragment Detail_item on Item { id image { url ref } unit { id name } }',
      ),
    ]);

    it('names the entity field and every shape', () => {
      expect(unmergedSplitSelections(split, {})).toEqual([
        'Item.image: { ref url } | { url }',
      ]);
    });

    it('accepts a merge stated on the field or on its value type', () => {
      expect(
        unmergedSplitSelections(split, {
          Item: { fields: { image: { merge: false } } },
        }),
      ).toEqual([]);
      expect(
        unmergedSplitSelections(split, { Image: { merge: true } }),
      ).toEqual([]);
    });

    it('sees a split one value deeper', () => {
      const deeper = nestedValueShapes(synthetic, [
        ...definitionsIn(
          'query A { item { id image { url credit { author } } } }',
        ),
        ...definitionsIn(
          'query B { item { id image { url credit { author license } } } }',
        ),
      ]);
      expect(unmergedSplitSelections(deeper, {})).toEqual([
        'Item.image: { credit { author license } url } | { credit { author } url }',
      ]);
    });
  });
});
