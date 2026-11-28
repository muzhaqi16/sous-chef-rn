import * as ts from 'typescript';
import { nodesOf, parseSource } from '#/test-utils/sourceAst';

/**
 * Every gate built on `#/test-utils/sourceAst` reads a file only as far as it
 * parses. A `.ts` file read as TSX misparses an angle-bracket assertion or a
 * generic arrow, and the nodes after the error never reach the gate, so it
 * passes on what it did not read.
 */
describe('the source parser', () => {
  const planted = `
    const amount = <number>value;
    const identity = <T,>(x: T) => x;
    export const after = sendLocalWrite(client, write);`;

  it('reads a .ts file as TypeScript, to its last statement', () => {
    const source = parseSource('planted.ts', planted);

    expect(nodesOf(source).some(ts.isTypeAssertionExpression)).toBe(true);
    expect(
      nodesOf(source).some(
        node =>
          ts.isCallExpression(node) &&
          node.expression.getText() === 'sendLocalWrite',
      ),
    ).toBe(true);
  });

  it('reads a .tsx file as TSX', () => {
    const source = parseSource('planted.tsx', 'const a = <View />;');

    expect(nodesOf(source).some(ts.isJsxSelfClosingElement)).toBe(true);
  });
});
