import { readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';

/**
 * The shared `useAppNavigation` mock stands in for the real hook in every test
 * that mocks it, so it offers what the hook returns: a member it lacks fails a
 * real screen at runtime, and one the hook lacks lets a test pass on a call the
 * app cannot make.
 */

const ROOT = path.join(__dirname, '..', '..');
const source = (relative: string) => {
  const file = path.join(ROOT, relative);
  return ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
};

const namesOf = (object: ts.ObjectLiteralExpression) =>
  object.properties.map(property => property.name?.getText() ?? '').sort();

/** The members of the object the hook returns. */
function returnedMembers(): string[] {
  let members: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === 'useAppNavigation'
    ) {
      const statements: readonly ts.Statement[] = node.body?.statements ?? [];
      const returned = statements.filter(ts.isReturnStatement).at(-1);
      if (
        returned?.expression &&
        ts.isObjectLiteralExpression(returned.expression)
      ) {
        members = namesOf(returned.expression);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source('src/hooks/navigation/useAppNavigation.ts'));
  return members;
}

/** The members of the mock's `mockNavigation` object. */
function mockedMembers(): string[] {
  let members: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText() === 'mockNavigation' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      members = namesOf(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(source('src/hooks/navigation/__mocks__/useAppNavigation.ts'));
  return members;
}

it('finds the members the hook returns', () => {
  expect(returnedMembers()).toContain('goBack');
});

it('mocks exactly what the hook returns', () => {
  expect(mockedMembers()).toEqual(returnedMembers());
});
