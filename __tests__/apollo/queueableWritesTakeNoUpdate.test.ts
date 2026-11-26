import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { REPLAY_PREPARATIONS } from '#apollo/offlineQueue/preparationRegistry';
import {
  SRC,
  authoredMutations,
  localFirstOperationNames,
  walk,
} from '#/test-utils/queueableOperations';

/**
 * A queued write's `update` never runs: the queue resolves the call with a null
 * payload, and the replay's result reaches only its `commit`. So what an answer
 * leaves to write goes in the operation's `commit`, which runs for both, and a
 * `useMutation` or `useLocalWrite` of a queueable operation takes no `update`
 * of its own.
 */

const ROOT = path.join(SRC, '..');
const WRITE_HOOKS: ReadonlySet<string> = new Set([
  'useMutation',
  'useLocalWrite',
]);

interface Hook {
  operation: string;
  at: string;
  takesUpdate: boolean;
}

const takesUpdate = (options: ts.Expression | undefined): boolean =>
  !!options &&
  ts.isObjectLiteralExpression(options) &&
  options.properties.some(
    property =>
      property.name &&
      ts.isIdentifier(property.name) &&
      property.name.text === 'update',
  );

/**
 * The operation a write hook sends: its document (`CreateHomeDocument`), its
 * binding (`createHomeWrite`), or the binding's document.
 */
function operationSent(sent: ts.Expression): string | undefined {
  const name = ts.isPropertyAccessExpression(sent)
    ? sent.expression.getText()
    : ts.isIdentifier(sent)
    ? sent.text
    : undefined;
  const document = /^(\w+)Document$/.exec(name ?? '')?.[1];
  if (document) return document;
  const binding = /^(\w+)Write$/.exec(name ?? '')?.[1];
  return binding && binding.charAt(0).toUpperCase() + binding.slice(1);
}

function hooksIn(file: string): Hook[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: Hook[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      WRITE_HOOKS.has(node.expression.text)
    ) {
      const [document, options] = node.arguments;
      const operation = document ? operationSent(document) : undefined;
      if (operation) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        found.push({
          operation,
          at: `${path.relative(ROOT, file)}:${line + 1}`,
          takesUpdate: takesUpdate(options),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const mutations = authoredMutations();
const queueable = new Set([
  ...Object.keys(REPLAY_PREPARATIONS),
  ...[...localFirstOperationNames()].filter(name => mutations.has(name)),
]);

const hooks = walk(SRC, name => /\.tsx?$/.test(name))
  .filter(
    file => !file.endsWith('.generated.ts') && !file.includes('__tests__'),
  )
  .flatMap(hooksIn)
  .filter(hook => queueable.has(hook.operation));

describe('a queueable write', () => {
  it('is found at all', () => {
    // A rename that made the scan match nothing would pass by checking nothing.
    expect(hooks.length).toBeGreaterThan(20);
  });

  it('leaves what an answer owes to its commit, never an update', () => {
    const offending = hooks
      .filter(hook => hook.takesUpdate)
      .map(hook => `${hook.operation} (${hook.at})`);
    expect(offending).toEqual([]);
  });
});
