import { readFileSync } from 'fs';
import * as ts from 'typescript';
import {
  lineOf,
  nodesOf,
  parseSource,
  productionSources,
  propertyName,
} from '#/test-utils/sourceAst';

/**
 * `useCreateShoppingList` settles with `present: 'none'` and hands its caller
 * the copy in `body`. A caller that returns quietly on `failed` leaves the
 * person with a spinner that stopped and no list — indistinguishable from a
 * create that worked.
 */

const HOOK = 'src/features/shoppingList/hooks/useCreateShoppingList.ts';
const FN = 'createShoppingList';

const enclosingFunction = (node: ts.Node): ts.Node => {
  let current: ts.Node = node;
  while (!ts.isFunctionLike(current) && !ts.isSourceFile(current)) {
    current = current.parent;
  }
  return current;
};

/** Every call of the create function, under any alias or through any object. */
function createCalls(source: ts.SourceFile): ts.CallExpression[] {
  const names = new Set([FN]);
  for (const node of nodesOf(source)) {
    if (
      ts.isBindingElement(node) &&
      node.propertyName &&
      ts.isIdentifier(node.propertyName) &&
      propertyName(node.propertyName) === FN &&
      ts.isIdentifier(node.name)
    ) {
      names.add(node.name.text);
    }
  }
  return nodesOf(source)
    .filter(ts.isCallExpression)
    .filter(call => {
      const callee = call.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : undefined;
      return name !== undefined && names.has(name);
    });
}

/** Each call whose own outcome's `body` is never read, as `file:line`. */
function silentCreates(file: string, text?: string): string[] {
  return createCalls(parseSource(file, text))
    .filter(call => {
      let holder: ts.Node = call.parent;
      if (ts.isAwaitExpression(holder)) holder = holder.parent;
      if (!ts.isVariableDeclaration(holder) || !ts.isIdentifier(holder.name)) {
        return true;
      }
      const outcome = holder.name.text;
      return !nodesOf(enclosingFunction(holder)).some(
        node =>
          ts.isPropertyAccessExpression(node) &&
          node.name.text === 'body' &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === outcome,
      );
    })
    .map(call => `${file}:${lineOf(call)}`);
}

describe('a refused list create reaches the person', () => {
  it('hands the caller copy to present', () => {
    const source = readFileSync(HOOK, 'utf8');
    expect(source).toContain("present: 'none'");
    expect(source).toContain('body:');
  });

  it('catches an outcome whose body goes unread, under any alias', () => {
    const planted = `
      const { createShoppingList: create } = useCreateShoppingList(copy);
      async function add() {
        const created = await create(input);
        if (created.status === 'failed') toastService.error(other.body);
      }
      async function quiet() {
        await deps.createShoppingList(input);
      }`;

    expect(silentCreates('planted.ts', planted)).toEqual([
      'planted.ts:4',
      'planted.ts:8',
    ]);
  });

  it('is presented at every call site', () => {
    const files = productionSources().filter(file => file !== HOOK);
    const sites = files.flatMap(file => createCalls(parseSource(file)));
    expect(sites.length).toBeGreaterThan(4);

    expect(files.flatMap(file => silentCreates(file))).toEqual([]);
  });
});
