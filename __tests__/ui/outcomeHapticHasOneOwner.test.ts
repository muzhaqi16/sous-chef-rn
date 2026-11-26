import { readFileSync } from 'node:fs';
import * as ts from 'typescript';
import {
  calleeName,
  lineOf,
  nodesOf,
  parseSource,
  productionSources,
} from '#/test-utils/sourceAst';

/**
 * An outcome haptic is fired by the toast host (`Toast.tsx`), which pairs one
 * with the toast TYPE so every `toastService` caller gets it. A caller that
 * fires its own beside a toast buzzes twice for one failure — which is how the
 * shopping list came to buzz twice where the pantry buzzed once.
 *
 * A haptic BEFORE an action (a selection on tap, a warning as a delete starts)
 * is a different thing and is not what this checks.
 */

const OUTCOMES = ['error', 'success', 'warning'];
const HOST = 'src/components/molecules/Toast.tsx';

/** `HapticService.error()` → 'haptic', `toastService.error(…)` → 'toast'. */
function outcomeCall(statement: ts.Statement): 'haptic' | 'toast' | undefined {
  if (!ts.isExpressionStatement(statement)) return undefined;
  let expression = statement.expression;
  if (ts.isAwaitExpression(expression)) expression = expression.expression;
  if (ts.isVoidExpression(expression)) expression = expression.expression;
  if (!ts.isCallExpression(expression)) return undefined;
  const callee = calleeName(expression) ?? '';
  const [owner, outcome] = callee.split('.');
  if (!outcome || !OUTCOMES.includes(outcome)) return undefined;
  if (owner === 'HapticService') return 'haptic';
  if (owner === 'toastService') return 'toast';
  return undefined;
}

/** Each block that fires both an outcome haptic and a toast, as `file:line`. */
function doubledOutcomes(file: string, text?: string): string[] {
  return nodesOf(parseSource(file, text))
    .filter(
      (node): node is ts.Block | ts.SourceFile =>
        ts.isBlock(node) || ts.isSourceFile(node),
    )
    .filter(block => {
      const calls = block.statements.map(outcomeCall);
      return calls.includes('haptic') && calls.includes('toast');
    })
    .map(block => `${file}:${lineOf(block)}`);
}

describe('an outcome haptic has one owner', () => {
  it('catches a haptic beside its toast, whatever runs between them', () => {
    const planted = `
      async function save() {
        HapticService.error();
        await reportFailure();
        toastService.error(t('errors.saveFailed'));
      }`;

    expect(doubledOutcomes('planted.ts', planted)).toEqual(['planted.ts:2']);
  });

  it('is not fired again beside the toast that already fires it', () => {
    const offenders = productionSources()
      .filter(file => file !== HOST)
      .flatMap(file => doubledOutcomes(file));
    expect(offenders).toEqual([]);
  });

  it('sees the pairing it is guarding — the toast host fires one per type', () => {
    const source = readFileSync(HOST, 'utf8');
    for (const type of OUTCOMES) {
      expect(source).toContain(`${type}: () => HapticService.${type}(),`);
    }
    // `info` is neutral and deliberately silent.
    expect(source).not.toContain('HapticService.info(');
  });
});
