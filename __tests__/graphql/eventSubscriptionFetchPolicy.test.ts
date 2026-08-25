import { readFileSync } from 'fs';
import { execSync } from 'child_process';

/**
 * An event subscription whose payload is an envelope plus a bare `node { id }`
 * must run with `fetchPolicy: 'no-cache'`.
 *
 * Cached, the envelope is written through as an entity carrying nothing but its
 * key. That is worst on a delete: the row is evicted locally before the
 * mutation fires, the server pushes the event, and the write re-creates the
 * entity the event exists to announce is gone. Its connection edge stops
 * dangling, the node now lacks every field the list query selects, and Apollo
 * repairs the incomplete result by refetching the whole page — one network
 * round-trip per delete, on a stream that is live app-wide.
 *
 * The rule is narrow on purpose: it applies only when every branch under `node`
 * selects nothing but `id`/`__typename`. `UserEvents` selects real fields and
 * is a legitimate write-through, so it is exempt by the same test that catches
 * the others — the shape decides, not a hand-kept list.
 *
 * Found the hard way on `PantryEvents` and `MyShoppingListsEvents`; `HomeEvents`
 * and `MealPlanEvents` had the identical shape and were still cached.
 */

const IDENTITY_FIELDS = new Set(['id', '__typename']);

/** Selection body of `node { ... }` within a subscription, or null. */
function nodeSelection(doc: string): string | null {
  const start = doc.search(/\bnode\s*\{/);
  if (start === -1) return null;
  let i = doc.indexOf('{', start);
  let depth = 0;
  for (let j = i; j < doc.length; j++) {
    if (doc[j] === '{') depth++;
    else if (doc[j] === '}') {
      depth--;
      if (depth === 0) return doc.slice(i + 1, j);
    }
  }
  return null;
}

/**
 * True when `node` carries only key fields — no data a screen could read.
 *
 * A NAMED spread (`...useNotifications_notification`) pulls in real fields, so
 * it disqualifies immediately. An INLINE fragment (`... on Membership`) is only
 * a type branch; what matters is the fields inside it.
 */
function isIdentityOnly(selection: string): boolean {
  const lines = selection
    .split('\n')
    .map(l => l.replace(/#.*$/, '').trim())
    .filter(Boolean);

  if (lines.some(l => /^\.\.\.(?!\s*on\b)/.test(l))) return false;

  const fields = lines
    .filter(l => !l.startsWith('...'))
    .map(l => l.replace(/[{}]/g, '').trim())
    .filter(Boolean);
  return fields.length > 0 && fields.every(f => IDENTITY_FIELDS.has(f));
}

const graphqlFiles = execSync(
  "find src -name '*.graphql' -not -path '*/generated/*'",
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);

const subscriptions: Array<{ name: string; identityOnly: boolean }> = [];
for (const file of graphqlFiles) {
  const src = readFileSync(file, 'utf8');
  for (const match of src.matchAll(/^subscription\s+(\w+)/gm)) {
    const name = match[1];
    const body = src.slice(match.index!);
    const end = body.indexOf('\n}');
    const doc = end === -1 ? body : body.slice(0, end);
    const selection = nodeSelection(doc);
    subscriptions.push({
      name,
      identityOnly: selection !== null && isIdentityOnly(selection),
    });
  }
}

describe('event subscriptions with an identity-only node', () => {
  it('finds the subscription documents to check', () => {
    expect(subscriptions.length).toBeGreaterThan(0);
  });

  const identityOnly = subscriptions.filter(s => s.identityOnly);

  // Guards the classifier itself: if either of these flips, the rule below has
  // stopped meaning what it says. `UserEvents` selects its fields directly;
  // `NotificationEvents` selects them through a named spread, and the unread
  // badge depends on Apollo normalizing that node BEFORE `onData` runs.
  it.each(['UserEvents', 'NotificationEvents'])(
    'classifies %s as a real write-through, not an envelope',
    name => {
      expect(subscriptions.find(s => s.name === name)?.identityOnly).toBe(false);
    },
  );

  it.each(identityOnly.map(s => s.name))(
    '%s runs with fetchPolicy no-cache',
    name => {
      const callSite = execSync(
        `grep -rln "useSubscription(${name}Document" src --include='*.ts' --include='*.tsx' || true`,
        { encoding: 'utf8' },
      ).trim();

      expect(callSite).not.toBe('');

      const src = readFileSync(callSite.split('\n')[0], 'utf8');
      const call = src.slice(src.indexOf(`useSubscription(${name}Document`));
      const options = call.slice(0, call.indexOf('\n  });'));
      expect(options).toContain("fetchPolicy: 'no-cache'");
    },
  );
});
