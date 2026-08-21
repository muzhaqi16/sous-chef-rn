import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Every `useSubscription` call must be paired with
 * `useSubscriptionTransportRecovery`.
 *
 * Recovery is a separate line beside the subscription rather than a wrapper, so
 * that the subscription keeps Apollo's own typing and the recovery is visible
 * at the call site. The cost of that choice is that it can be forgotten — and
 * forgetting it is invisible: the subscription works normally right up until
 * the socket ends it with a code graphql-ws refuses to retry, after which it
 * delivers nothing for the rest of the session, with no error and no log.
 *
 * That is what this test is for. It reads source rather than rendering, because
 * the failure it guards is the ABSENCE of a call, which no render can observe.
 */

const SRC = join(__dirname, '..', '..', 'src');

/**
 * Strip comments, so a doc comment that merely MENTIONS `useSubscription(` —
 * `services/subscriptions/types.ts` describes the call it feeds — is not
 * mistaken for a call site.
 */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const collectSourceFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      collectSourceFiles(full, out);
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
      !entry.endsWith('.generated.ts')
    ) {
      out.push(full);
    }
  }
  return out;
};

describe('subscription transport recovery coverage', () => {
  const files = collectSourceFiles(SRC).map(path => ({
    path,
    source: stripComments(readFileSync(path, 'utf-8')),
  }));

  const callSites = files.filter(
    ({ path, source }) =>
      // The hook itself documents the pairing; it does not subscribe.
      !path.endsWith('useSubscriptionTransportRecovery.ts') &&
      /\buseSubscription\(/.test(source),
  );

  it('finds the subscription call sites it is meant to be guarding', () => {
    // A rename or a move that made the scan match nothing would otherwise let
    // this test pass by checking an empty list.
    expect(callSites.length).toBeGreaterThanOrEqual(6);
  });

  it.each(callSites.map(({ path }) => path))(
    '%s pairs every useSubscription with transport recovery',
    path => {
      const source = files.find(f => f.path === path)!.source;

      const subscriptions = source.match(/\buseSubscription\(/g)?.length ?? 0;
      const recoveries =
        source.match(/\buseSubscriptionTransportRecovery\(/g)?.length ?? 0;

      expect(recoveries).toBe(subscriptions);
    },
  );
});
