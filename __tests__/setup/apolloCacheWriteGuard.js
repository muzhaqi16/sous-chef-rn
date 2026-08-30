/**
 * The Apollo missing-field guard, as a module so its breadth can be tested.
 *
 * `__tests__/setup/globals.js` wires this into the `console.error` spy and the
 * `afterEach` / `afterAll` hooks. It lives here rather than inline because an
 * exemption is a hole cut in a guard: what it suppresses and what it still
 * reports has to be demonstrable, and a predicate buried in a setup file's
 * closure cannot be.
 *
 * Guarded by `__tests__/apollo/missingFieldGuardBreadth.test.ts`.
 */

/** Matches Apollo's message template, which arrives as `args[0]`. */
const APOLLO_MISSING_FIELD = /Missing field '[^']+' while writing result/;

// Apollo raises the diagnostic as `invariant.error(116, fieldName, record)`
// (`cache/inmemory/writeToStore.js:233`), so the field it names and the record
// it is about both arrive as structured arguments. Exemptions key on those.
//
// Keying on the RENDERED message instead is the one thing that cannot work:
// `util.format`'s `%o` renders the whole record, so a pattern naming a type
// matches every diagnostic about every field of every payload that contains
// one. A branch documenting five fields of one record was suppressing ninety
// writes across `src/features/shoppingList` and `src/apollo`.
//
// EMPTY, and an invariant rather than a tally: a missing field has a real cause
// in every case currently known, so an entry here is a claim to be argued for
// rather than a queue to work through.
//
// It held one — five fields of `ShoppingListItemPurchaseInfo`, excused because
// `writePurchaseInfo` reported them in production too and so was "the design
// working". The production report was real; the conclusion was backwards. The
// writer was asserting a seven-field fragment while supplying the two the list
// screen caches, and narrowing the fragment to the write
// (`purchaseInfoWriteFragment`) removed the diagnostic without changing a byte
// of what reaches the store. An exemption written from a diagnostic rather than
// from its cause excuses the defect instead of finding it.
const EXPECTED_MISSING_FIELDS = new Map();

function isApolloMissingFieldError(args) {
  return typeof args[0] === 'string' && APOLLO_MISSING_FIELD.test(args[0]);
}

/** Whether a caller-registered `Type.field` exemption covers this diagnostic. */
function isExemptedPair(args, exemptions) {
  if (!exemptions || exemptions.size === 0) return false;
  const field = args[1];
  const record = args[2];
  if (typeof field !== 'string') return false;
  if (!record || typeof record !== 'object') return false;
  return exemptions.has(`${record.__typename}.${field}`);
}

/** Whether this exact `(record type, field)` pair is absent by design. */
function isExpectedMissingField(args) {
  const field = args[1];
  const record = args[2];
  // Anything that does not arrive in the documented shape is reported. An
  // exemption that cannot read its own key must not fall open.
  if (typeof field !== 'string') return false;
  if (!record || typeof record !== 'object') return false;
  const expected = EXPECTED_MISSING_FIELDS.get(record.__typename);
  return expected !== undefined && expected.has(field);
}

// Collected during the test, reported in `afterEach`. Throwing from inside the
// `console.error` spy instead would abort Apollo's write mid-flight: the
// mutation never settles, and the test fails as a 5s `waitFor` timeout naming
// the wrong thing. Collecting keeps Apollo's control flow intact so the test
// fails on the real reason.
//
// Each entry carries the test that was running when the write happened. Without
// that, a write settling after its own test is either cleared unseen by the next
// `beforeEach` or reported as the next test's failure; with it, the entry names
// the test whose behaviour produced it, whichever test's teardown reads it.
const collected = [];

function currentTestName() {
  try {
    return expect.getState().currentTestName ?? '(outside a test)';
  } catch {
    return '(outside a test)';
  }
}

/**
 * Decide what to do with one `console.error` call.
 *
 * @returns `true` when the call was collected as a defect, `false` when it was
 * not a missing-field diagnostic or was exempt.
 */
function collectCacheWriteError(args, { exemptions } = {}) {
  if (!isApolloMissingFieldError(args)) return false;
  if (isExpectedMissingField(args)) return false;
  // The test marked a mock `partial`, so the fields THAT payload omits are its
  // subject. The exemptions are the `(type, field)` pairs derived from the mock
  // itself, not a switch that turns the guard off for the whole test — a
  // whole-test switch lets one deliberately-partial mock silence every other
  // write in the file.
  if (isExemptedPair(args, exemptions)) return false;
  // Apollo hands the template and its substitutions separately —
  // `console.error("Missing field '%s' while writing result %o", name, obj)` —
  // so the raw `args[0]` names neither the field nor the payload.
  collected.push({
    testName: currentTestName(),
    message: require('node:util').format(...args),
  });
  return true;
}

function reportCollectedCacheWriteErrors(where) {
  if (collected.length === 0) return;
  const entries = collected.splice(0);
  const byTest = new Map();
  for (const { testName, message } of entries) {
    if (!byTest.has(testName)) byTest.set(testName, new Set());
    byTest.get(testName).add(message);
  }
  const report = [...byTest.entries()]
    .map(([testName, messages]) =>
      [`  ${testName}`, ...[...messages].map(m => `    - ${m}`)].join('\n'),
    )
    .join('\n');
  throw new Error(
    'Apollo cache write error — a mock is missing a field its operation ' +
      'selects. The whole cache read goes incomplete, so this hides real ' +
      'behaviour rather than just adding noise. Add the field to the mock.\n\n' +
      report +
      (where === 'afterAll'
        ? '\n\nThis landed after the last test in the file finished, so the ' +
          'write is not being awaited. Await it in the test that starts it.'
        : ''),
  );
}

/** What has been collected and not yet reported. For this guard's own tests. */
function peekCollectedCacheWriteErrors() {
  return collected.map(entry => ({ ...entry }));
}

/** Drop anything collected without reporting. For this guard's own tests. */
function resetCollectedCacheWriteErrors() {
  collected.length = 0;
}

module.exports = {
  EXPECTED_MISSING_FIELDS,
  isExemptedPair,
  isApolloMissingFieldError,
  isExpectedMissingField,
  collectCacheWriteError,
  reportCollectedCacheWriteErrors,
  peekCollectedCacheWriteErrors,
  resetCollectedCacheWriteErrors,
};
