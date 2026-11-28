import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import * as ts from 'typescript';
import { lineOf, nodesOf, parseSource } from '#/test-utils/sourceAst';

/**
 * A "the thing went away" assertion must first show the thing was there.
 *
 * `waitFor(element(...)).not.toBeVisible()` passes IMMEDIATELY when the matcher
 * finds nothing at all. So an assertion written against the wrong id, or the
 * right id on the wrong screen, does not fail — it succeeds instantly and the
 * test continues as though the behaviour were verified.
 *
 * That is not hypothetical. `ShoppingListScreen.addItem` ended its flow with
 *
 *     waitFor(element(by.id('add-shopping-item-modal'))).not.toBeVisible()
 *
 * as the check that the item had been submitted. That id belongs to the PICKER
 * sheet, which is not on screen at that point in the flow, so the step asserted
 * nothing whatsoever and the run continued whether or not anything had been
 * saved. It was green for as long as it existed.
 *
 * The rule that makes such an assertion meaningful is simple: somewhere EARLIER
 * in the same `it` block, the same target must have been positively
 * established — waited for, tapped, typed into, or asserted present. Then
 * "it is gone now" is a real state change rather than a matcher that missed.
 *
 * WHAT THIS DOES NOT CATCH, stated plainly because the gap matters more than
 * the coverage: it cannot tell whether the target was on screen at that moment.
 * The `add-shopping-item-modal` bug above is NOT caught here — that id is
 * tapped elsewhere in the same file, so it clears this rule while still being
 * the wrong id for that point in the flow. Only proving presence AT RUNTIME
 * catches that, which is what `expectDisappearsAfter` in
 * `e2e/helpers/assertions.ts` is for: it waits for the element, runs the
 * action, then waits for it to go. Prefer it whenever the disappearance IS the
 * assertion.
 *
 * What this catches is the narrower, unambiguous case: a target the spec only
 * ever asserts the ABSENCE of, so nothing anywhere establishes it can appear.
 * Scoped that tightly on purpose — a broader textual rule reports every
 * presence established through a screen-object call, and an exemption list of
 * false positives is how a guard stops meaning anything.
 *
 * SCOPE, so nobody mistakes green here for coverage:
 *   - Only `it`/`test` bodies in `e2e/tests`. Assertions in `beforeEach`,
 *     `afterEach`, helpers and screen objects are NOT examined — and the bug
 *     that motivated this file lived in a SCREEN OBJECT, so it would not have
 *     been caught here either.
 *   - Textual, not semantic. It knows the argument appears somewhere else in
 *     the file, not that the element was genuinely on screen first.
 *
 * Verified falsifiable: injecting
 * `waitFor(element(by.id('never-rendered-anywhere'))).not.toBeVisible()` into an
 * `it` block fails this test, and removing it goes green.
 */
const E2E_TESTS = join(__dirname, '..', '..', 'e2e', 'tests');

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.e2e\.ts$/.test(entry)) out.push(full);
  }
  return out;
};

/** `element(by.id|text|label(arg))` as `arg`'s text; otherwise undefined. */
const matcherArgument = (node: ts.Expression): string | undefined => {
  if (
    !ts.isCallExpression(node) ||
    !ts.isIdentifier(node.expression) ||
    node.expression.text !== 'element'
  ) {
    return undefined;
  }
  const [by] = node.arguments;
  if (
    !by ||
    !ts.isCallExpression(by) ||
    !/^by\.(id|text|label)$/.test(by.expression.getText())
  ) {
    return undefined;
  }
  return by.arguments[0]?.getText().replace(/\s+/g, '');
};

/** What a negated `expect(x)` or `waitFor(x)` names, through a variable too. */
const targetOf = (subject: ts.Expression): string | undefined => {
  const direct = matcherArgument(subject);
  if (direct || !ts.isIdentifier(subject)) return direct;
  const declaration = nodesOf(subject.getSourceFile()).find(
    (node): node is ts.VariableDeclaration =>
      ts.isVariableDeclaration(node) && node.name.getText() === subject.text,
  );
  return declaration?.initializer && matcherArgument(declaration.initializer);
};

/**
 * Each negated target the file never names anywhere else, as `file:line target`.
 *
 * Compares the matcher's ARGUMENT (`'Cheese'`, `itemName`, `NAME_INPUT`), and
 * across the whole file: presence is very often established through a
 * screen-object method (`expectItemInPantry(name)`) or a `beforeAll` seed that
 * no parser can follow, so a target counts as established when it is used
 * anywhere else. What survives is the unambiguous case: a target the spec ONLY
 * ever asserts the absence of.
 */
function unprovenTargets(file: string, text?: string): string[] {
  const source = parseSource(file, text);
  const flat = source.getFullText().replace(/\s+/g, '');
  return nodesOf(source)
    .filter(ts.isPropertyAccessExpression)
    .filter(
      access =>
        (access.name.text === 'toBeVisible' ||
          access.name.text === 'toExist') &&
        ts.isPropertyAccessExpression(access.expression) &&
        access.expression.name.text === 'not' &&
        ts.isCallExpression(access.expression.expression),
    )
    .flatMap(access => {
      const holder = access.expression;
      const call = ts.isPropertyAccessExpression(holder)
        ? holder.expression
        : undefined;
      const [subject] = call && ts.isCallExpression(call) ? call.arguments : [];
      const target = subject && targetOf(subject);
      if (!target) return [];
      const occurrences = flat.split(target).length - 1;
      return occurrences <= 1 ? [`${file}:${lineOf(access)}  ${target}`] : [];
    });
}

describe('e2e disappearance assertions are falsifiable', () => {
  const files = walk(E2E_TESTS);

  it('finds spec files and negations, so the check is not vacuous', () => {
    expect(files.length).toBeGreaterThan(3);
    const anyNegation = files.some(file =>
      /\.not\s*\.\s*(?:toBeVisible|toExist)/.test(readFileSync(file, 'utf8')),
    );
    expect(anyNegation).toBe(true);
  });

  it('catches a target held in a variable, past the calls between', () => {
    const planted = `
      it('closes the banner', async () => {
        const banner = element(by.id('only-ever-absent'));
        await element(by.id('save')).tap();
        await element(by.id('save')).tap();
        await expect(banner).not.toBeVisible();
      });`;

    expect(unprovenTargets('planted.e2e.ts', planted)).toEqual([
      "planted.e2e.ts:6  'only-ever-absent'",
    ]);
  });

  it('every negated target is established somewhere in its spec', () => {
    const root = join(__dirname, '..', '..');
    expect(
      files.flatMap(file => unprovenTargets(relative(root, file))),
    ).toEqual([]);
  });
});
