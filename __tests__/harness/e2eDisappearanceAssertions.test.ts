import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

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

/** Split a source file into `it(...)`/`test(...)` blocks by brace depth. */
const itBlocks = (source: string): { start: number; body: string }[] => {
  const blocks: { start: number; body: string }[] = [];
  const opener = /\b(?:it|test)(?:\.\w+)?\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = opener.exec(source))) {
    let depth = 0;
    let index = match.index + match[0].length - 1;
    for (; index < source.length; index++) {
      const char = source[index];
      if (char === '(') depth++;
      else if (char === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push({
      start: source.slice(0, match.index).split('\n').length,
      body: source.slice(match.index, index + 1),
    });
  }
  return blocks;
};

/**
 * Every `.not.toBeVisible()` / `.not.toExist()` in a block, paired with the
 * matcher it applies to and whether that matcher was used earlier.
 *
 * Done per-negation, with positions. An earlier version searched for the FIRST
 * negation in the block and checked against that one index, so a block with two
 * negations validated the second against the first's position and waved through
 * exactly the shape this file exists to catch.
 */
const unprovenTargets = (block: string, file: string): string[] => {
  const negation = /\.not\s*\.\s*(?:toBeVisible|toExist)\s*\(/g;
  const elementCall = /element\(\s*by\.(?:id|text|label)\(\s*([^)]*?)\s*\)\s*\)/g;
  const unproven: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = negation.exec(block))) {
    const before = block.slice(0, match.index);

    // The element(...) this negation applies to is the closest one before it.
    const calls = [...before.matchAll(elementCall)];
    const own = calls[calls.length - 1];
    if (!own) continue;

    const target = own[1].replace(/\s+/g, '');

    // Compares the matcher's ARGUMENT (`'Cheese'`, `itemName`, `NAME_INPUT`),
    // not the whole `by.text(...)` expression. Presence is usually established
    // in a form that never mentions the matcher — `addItem('Cheese', '8', 'oz')`
    // in a `beforeAll` is what puts that row on screen. Matching on the whole
    // expression reported those as unproven, which they are not.
    //
    // Established if the argument is used ANYWHERE ELSE in the file — seeded,
    // waited for, tapped, typed into, or asserted present.
    //
    // File scope, not block scope, and deliberately so. Presence is very often
    // established through a screen-object method (`expectItemInPantry(name)`,
    // `openAddDetailsForm()`) that no textual parser can follow, so a
    // block-scoped rule reports those as unproven. They are not, and an
    // exemption list of false positives is how a guard stops meaning anything.
    //
    // What survives this rule is the unambiguous case: a target the spec ONLY
    // ever asserts the absence of, so nothing anywhere shows it can be present.
    const occurrences = file.replace(/\s+/g, '').split(target).length - 1;
    if (occurrences <= 1) unproven.push(target);
  }
  return unproven;
};

describe('e2e disappearance assertions are falsifiable', () => {
  const files = walk(E2E_TESTS);

  it('finds spec files and negations, so the check is not vacuous', () => {
    expect(files.length).toBeGreaterThan(3);
    const anyNegation = files.some(file =>
      /\.not\s*\.\s*(?:toBeVisible|toExist)/.test(readFileSync(file, 'utf8')),
    );
    expect(anyNegation).toBe(true);
  });

  it('every negated target is established earlier in the same test', () => {
    const unproven: string[] = [];

    for (const file of files) {
      const rel = relative(join(__dirname, '..', '..'), file);
      const source = readFileSync(file, 'utf8');
      for (const { start, body } of itBlocks(source)) {
        for (const target of unprovenTargets(body, source)) {
          unproven.push(`${rel}:~${start}  ${target}`);
        }
      }
    }

    expect([...new Set(unproven)]).toEqual([]);
  });
});
