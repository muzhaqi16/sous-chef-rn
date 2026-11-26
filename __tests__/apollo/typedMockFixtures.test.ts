import { readFileSync } from 'fs';
import { sync as glob } from 'glob';
import { join } from 'path';
import * as ts from 'typescript';
import {
  calleeName,
  lineOf,
  nodesOf,
  parseSource,
  propertyName,
} from '#/test-utils/sourceAst';

/**
 * A hand-built mock states its operation's data, so it is typed by that
 * operation's document.
 *
 * `MockedResponse` defaults its data to `Record<string, unknown>`, so a bare
 * annotation checks nothing: a fixture naming a union member the schema dropped
 * (`UserPayload` for `completeOnboarding`), a field the operation cannot return,
 * a raw `'MEMBER'` where the enum belongs, or a stale `'BulkNotificationSummary'`
 * all compiled. The mock contract catches those when the mock is SERVED, so one
 * that no test fires is unchecked in both directions.
 *
 * `MockFor<typeof XDocument>` reads the shape off codegen while leaving what the
 * fixture omits to SDL completion. `recordMock` already types its `data` from
 * the document it takes, so a builder returning `recordMock(…).mock` is checked
 * where it is built and may still declare the bare type.
 */

const HELPER = join('__tests__', 'helpers', 'apolloMockProvider.tsx');
/** This file quotes the pattern it bans, so it cannot scan itself. */
const SELF = join('__tests__', 'apollo', 'typedMockFixtures.test.ts');

const sources = glob('{src,__tests__}/**/*.{ts,tsx}').filter(
  file => file !== HELPER && file !== SELF,
);

/** A bare `MockedResponse`: no operation type argument, and not an array. */
const isBareMock = (type: ts.TypeNode | undefined): boolean =>
  !!type &&
  ts.isTypeReferenceNode(type) &&
  type.typeName.getText() === 'MockedResponse' &&
  !type.typeArguments;

/** An object literal that writes its own `request: { query }`. */
const buildsRequest = (init: ts.Expression | undefined): boolean => {
  if (!init || !ts.isObjectLiteralExpression(init)) return false;
  const request = init.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      propertyName(property.name) === 'request',
  );
  return (
    !!request &&
    ts.isObjectLiteralExpression(request.initializer) &&
    request.initializer.properties.some(
      property =>
        (ts.isPropertyAssignment(property) ||
          ts.isShorthandPropertyAssignment(property)) &&
        propertyName(property.name) === 'query',
    )
  );
};

/** Hand-built fixtures typed only as a bare `MockedResponse`, as `file:line`. */
function handBuiltIn(file: string, text?: string): string[] {
  return nodesOf(parseSource(file, text))
    .filter(ts.isVariableDeclaration)
    .filter(declaration => isBareMock(declaration.type))
    .filter(declaration => {
      const init = declaration.initializer;
      const delegates =
        !!init &&
        ts.isCallExpression(init) &&
        calleeName(init) === 'recordMock';
      return !delegates && buildsRequest(init);
    })
    .map(declaration => `${file}:${lineOf(declaration)}`);
}

const handBuilt = sources.flatMap(file => handBuiltIn(file));

it('catches a hand-built mock whose request comes after a long result', () => {
  const planted = `const mock: MockedResponse = {
    result: { data: ${JSON.stringify({ rows: Array(40).fill('row') })} },
    request: { query: GetPantryDocument },
  };`;

  expect(handBuiltIn('planted.ts', planted)).toEqual(['planted.ts:1']);
});

it('finds the mock fixtures at all, so the check below is not vacuous', () => {
  const typed = sources.filter(file =>
    readFileSync(join(process.cwd(), file), 'utf8').includes('MockFor<typeof '),
  );

  expect(typed.length).toBeGreaterThanOrEqual(40);
});

it('every hand-built mock is typed by its operation', () => {
  expect(handBuilt).toEqual([]);
});
