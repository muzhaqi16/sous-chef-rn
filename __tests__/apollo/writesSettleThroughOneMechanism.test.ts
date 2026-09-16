import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { SRC, walk } from '#/test-utils/queueableOperations';

/**
 * Every write settles through `settleMutation`. A `useMutation` `onError` sees
 * only a thrown failure, never a refusal resolved as data, and `unwrapPayload`
 * turns a refusal into a throw its caller reports by a path of its own.
 */
const ROOT = path.join(SRC, '..');

const KIT = [
  'src/apollo/utils/settleMutation.ts',
  'src/apollo/utils/localFirstFields.ts',
];

const isScanned = (relative: string) =>
  !/(^|\/)__mocks__\//.test(relative) &&
  !relative.endsWith('.generated.ts') &&
  !relative.startsWith('src/apollo/offlineQueue/') &&
  !KIT.includes(relative);

const calleeName = (call: ts.CallExpression): string | undefined =>
  ts.isIdentifier(call.expression) ? call.expression.text : undefined;

const hasOnError = (options: ts.Expression | undefined): boolean =>
  !!options &&
  ts.isObjectLiteralExpression(options) &&
  options.properties.some(
    property =>
      !!property.name &&
      ts.isIdentifier(property.name) &&
      property.name.text === 'onError',
  );

function offendersIn(relative: string): string[] {
  const source = ts.createSourceFile(
    relative,
    fs.readFileSync(path.join(ROOT, relative), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: string[] = [];
  const at = (node: ts.Node) =>
    `${relative}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node);
      const [, options] = node.arguments;
      if (name === 'useMutation' && hasOnError(options)) {
        found.push(`${at(node)} useMutation with onError`);
      }
      if (name === 'unwrapPayload') {
        found.push(`${at(node)} unwrapPayload`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const scanned = walk(SRC, name => /\.tsx?$/.test(name))
  .map(file => path.relative(ROOT, file).split(path.sep).join('/'))
  .filter(isScanned);

describe('writes settle through one mechanism', () => {
  it('scans the source tree', () => {
    expect(scanned.length).toBeGreaterThan(100);
  });

  it('reads no write outcome through onError or unwrapPayload', () => {
    expect(scanned.flatMap(offendersIn)).toEqual([]);
  });
});
