import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { REPLAY_PREPARATIONS } from '#/apollo/offlineQueue/preparationRegistry';
import { REPLAY_RECONCILERS } from '#/apollo/offlineQueue/replayRegistry';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  SRC,
  authoredMutations,
  localFirstOperationNames,
  walk,
} from '#/test-utils/queueableOperations';

/**
 * A queued write's `update` never runs: the queue resolves the call with a null
 * payload, and the replay's own result reaches only `REPLAY_RECONCILERS`. So a
 * foreground `update` that adopts the server's entity or withdraws the local
 * one does NOTHING for the same write made offline, unless the operation also
 * has a replay reconciler. This pairs the two.
 *
 * Operations are found, not listed: every `useMutation(XDocument, { update })`
 * whose operation is queueable (registered for replay, or sent with `localFirst`), and
 * whose `update` evicts an entity — directly, or through the functions it calls,
 * followed across modules. Every adoption and every withdrawal ends in one.
 */

const ROOT = path.join(SRC, '..');

type Fn = ts.FunctionLikeDeclaration;

interface ParsedModule {
  source: ts.SourceFile;
  /** Top-level functions, by the name the module declares them under. */
  functions: Map<string, Fn>;
  /** Local name → where it comes from. */
  imports: Map<string, { module: string; name: string }>;
}

const parsed = new Map<string, ParsedModule | null>();

function resolveModule(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('.')) {
    base = path.resolve(path.dirname(from), specifier);
  } else if (specifier.startsWith('#/')) {
    base = path.join(SRC, specifier.slice(2));
  } else if (specifier.startsWith('#')) {
    const [alias = '', ...rest] = specifier.slice(1).split('/');
    const dir =
      alias === 'operations'
        ? path.join('graphql', 'operations')
        : alias === 'generated'
        ? path.join('graphql', 'generated')
        : alias;
    base = path.join(SRC, dir, ...rest);
  } else {
    return null;
  }
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function parseModule(file: string): ParsedModule | null {
  if (parsed.has(file)) return parsed.get(file) ?? null;
  if (file.endsWith('.generated.ts')) {
    parsed.set(file, null);
    return null;
  }
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const functions = new Map<string, Fn>();
  const imports = new Map<string, { module: string; name: string }>();
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      functions.set(statement.name.text, statement);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const { name, initializer } = declaration;
        if (
          ts.isIdentifier(name) &&
          initializer &&
          (ts.isArrowFunction(initializer) ||
            ts.isFunctionExpression(initializer))
        ) {
          functions.set(name.text, initializer);
        }
      }
    } else if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      const module = resolveModule(file, statement.moduleSpecifier.text);
      if (!module) continue;
      for (const element of statement.importClause.namedBindings.elements) {
        imports.set(element.name.text, {
          module,
          name: (element.propertyName ?? element.name).text,
        });
      }
    }
  }
  const module = { source, functions, imports };
  parsed.set(file, module);
  return module;
}

/** Where the function `name`, as seen from `file`, is declared. */
function declarationOf(
  file: string,
  name: string,
): { file: string; fn: Fn } | null {
  const module = parseModule(file);
  if (!module) return null;
  const local = module.functions.get(name);
  if (local) return { file, fn: local };
  const imported = module.imports.get(name);
  return imported ? declarationOf(imported.module, imported.name) : null;
}

const isEvictItem = (node: ts.Node): boolean =>
  ts.isPropertyAssignment(node) &&
  ts.isIdentifier(node.name) &&
  node.name.text === 'evictItem' &&
  node.initializer.kind === ts.SyntaxKind.TrueKeyword;

const EVICTORS = new Set(['safeEvict', 'safeEvictMany']);

/** Whether running `node` evicts an entity, following the calls it makes. */
function evicts(file: string, node: ts.Node, seen: Set<Fn>): boolean {
  let found = false;
  const visit = (child: ts.Node) => {
    if (found) return;
    if (isEvictItem(child)) {
      found = true;
      return;
    }
    if (ts.isCallExpression(child)) {
      const callee = child.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === 'evict'
      ) {
        found = true;
        return;
      }
      if (ts.isIdentifier(callee)) {
        if (EVICTORS.has(callee.text)) {
          found = true;
          return;
        }
        const target = declarationOf(file, callee.text);
        if (target && !seen.has(target.fn)) {
          seen.add(target.fn);
          if (evicts(target.file, target.fn, seen)) {
            found = true;
            return;
          }
        }
      }
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

const propertyNamed = (
  options: ts.ObjectLiteralExpression,
  name: string,
): ts.Node | undefined => {
  for (const property of options.properties) {
    if (!property.name || !ts.isIdentifier(property.name)) continue;
    if (property.name.text !== name) continue;
    if (ts.isPropertyAssignment(property)) return property.initializer;
    if (ts.isMethodDeclaration(property)) return property;
    if (ts.isShorthandPropertyAssignment(property)) return property.name;
  }
  return undefined;
};

interface ForegroundUpdate {
  operation: string;
  at: string;
  evicts: boolean;
}

function foregroundUpdatesIn(file: string): ForegroundUpdate[] {
  const module = parseModule(file);
  if (!module) return [];
  const found: ForegroundUpdate[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'useMutation'
    ) {
      const [document, options] = node.arguments;
      const operation =
        document && ts.isIdentifier(document)
          ? /^(\w+)Document$/.exec(document.text)?.[1]
          : undefined;
      const update =
        options && ts.isObjectLiteralExpression(options)
          ? propertyNamed(options, 'update')
          : undefined;
      if (operation && update) {
        const line =
          module.source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        found.push({
          operation,
          at: `${path.relative(ROOT, file)}:${line}`,
          evicts: evicts(file, update, new Set()),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(module.source);
  return found;
}

const mutations = authoredMutations();
const queueable = new Set([
  ...Object.keys(REPLAY_PREPARATIONS),
  ...[...localFirstOperationNames()].filter(name => mutations.has(name)),
]);

const updates = walk(SRC, name => /\.tsx?$/.test(name))
  .filter(file => !file.endsWith('.generated.ts'))
  .flatMap(foregroundUpdatesIn)
  .filter(update => queueable.has(update.operation));

const pairedUpdates = updates.filter(update => update.evicts);

describe('replay reconciler coverage', () => {
  it('finds the foreground updates it is meant to be pairing', () => {
    // A rename that made the scan match nothing would pass by checking nothing.
    expect(updates.length).toBeGreaterThanOrEqual(10);
    expect(pairedUpdates.length).toBeGreaterThanOrEqual(5);
  });

  it('follows an update through the modules it calls', () => {
    // `buildAddItemsReconcileUpdate` evicts three calls deep, in another module.
    expect(
      pairedUpdates.some(
        update =>
          update.operation === operationNameOf(AddItemToShoppingListDocument),
      ),
    ).toBe(true);
  });

  it('gives every queueable adopting or withdrawing update a replay reconciler', () => {
    const unpaired = pairedUpdates
      .filter(update => !REPLAY_RECONCILERS[update.operation])
      .map(update => `${update.operation} (${update.at})`);
    expect(unpaired).toEqual([]);
  });
});
