import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  Kind,
  parse,
  print,
  type FragmentDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
import { OPERATION_ROOT_DIRS } from '#/test-utils/sourceRoots';

/**
 * A list a core hook runs spreads a core `listed` fragment, and each of its
 * cells reads its own fragment from the cache by id. The cell renders only when
 * the cache holds every field it selects, so the listed fragment covers each
 * cell's fragment; a field a cell gains and the list does not fetch would blank
 * the cell rather than fail anywhere else.
 */
const LISTED: Record<string, string[]> = {
  home_listed: ['HomeCard_home'],
  pantryItem_listed: [
    'PantryItemCard_pantryItem',
    'PantryActionModal_pantryItem',
  ],
  shoppingListItem_listed: ['SortableItem_item'],
};

const fragments = new Map<string, FragmentDefinitionNode>();
const walk = (dir: string) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'generated' && entry.name !== '__tests__') walk(full);
    } else if (entry.name.endsWith('.graphql')) {
      for (const definition of parse(fs.readFileSync(full, 'utf8'))
        .definitions) {
        if (definition.kind === Kind.FRAGMENT_DEFINITION) {
          fragments.set(definition.name.value, definition);
        }
      }
    }
  }
};
OPERATION_ROOT_DIRS.forEach(dir => walk(dir));

/** Every field path a selection reaches, its arguments included, spreads followed. */
function fieldPaths(
  selectionSet: SelectionSetNode,
  prefix = '',
  out = new Set<string>(),
): Set<string> {
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      if (selection.name.value === '__typename') continue;
      const args = selection.arguments?.length
        ? `(${selection.arguments
            .map(arg => `${arg.name.value}: ${print(arg.value)}`)
            .join(', ')})`
        : '';
      const fieldPath = `${prefix}.${selection.name.value}${args}`;
      out.add(fieldPath);
      if (selection.selectionSet) {
        fieldPaths(selection.selectionSet, fieldPath, out);
      }
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = fragments.get(selection.name.value);
      if (!fragment) throw new Error(`No fragment ${selection.name.value}`);
      fieldPaths(fragment.selectionSet, prefix, out);
    } else {
      fieldPaths(selection.selectionSet, prefix, out);
    }
  }
  return out;
}

const pathsOf = (name: string): Set<string> => {
  const fragment = fragments.get(name);
  if (!fragment) throw new Error(`No fragment ${name}`);
  return fieldPaths(fragment.selectionSet);
};

describe('listed fragments cover the cells that read through them', () => {
  it.each(
    Object.entries(LISTED).flatMap(([listed, cells]) =>
      cells.map((cell): [string, string] => [listed, cell]),
    ),
  )('%s covers %s', (listed, cell) => {
    const covered = pathsOf(listed);
    expect([...pathsOf(cell)].filter(p => !covered.has(p))).toEqual([]);
  });

  it('reports a field a cell selects and its list does not', () => {
    const cell = pathsOf('HomeCard_home');
    const fewer = new Set(
      [...pathsOf('home_listed')].filter(p => p !== '.name'),
    );
    expect([...cell].filter(p => !fewer.has(p))).toEqual(['.name']);
  });
});
