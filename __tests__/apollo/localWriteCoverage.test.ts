import { LOCAL_WRITES } from '#/apollo/pendingWrites/localWriteRegistry';
import {
  authoredMutations,
  localFirstOperationNames,
} from '#/test-utils/queueableOperations';

/** Sent local-first with no local write of their own, each with its reason. */

const NO_LOCAL_WRITE: Record<string, string> = {
  MarkExpirationAction:
    'writes the notification store, not the cache: its answer states neither the row nor the badge',
  MarkRecipeAsCooked:
    'shows nothing until answered: the server picks the stacks it deducts',
  MovePurchasedItemsToPantry:
    'shows nothing until answered: the server picks the lines, and the pantry reads the rows',
};

const localFirst = () => {
  const authored = authoredMutations();
  return [...localFirstOperationNames()].filter(name => authored.has(name));
};

describe('local-first operations', () => {
  it('each has a local write, or a stated reason for having none', () => {
    const uncovered = localFirst()
      .filter(name => !LOCAL_WRITES[name] && !NO_LOCAL_WRITE[name])
      .sort();

    expect(uncovered).toEqual([]);
  });

  it('keeps the reasons honest', () => {
    const operations = new Set(localFirst());
    const stale = Object.keys(NO_LOCAL_WRITE).filter(
      name => !operations.has(name) || LOCAL_WRITES[name],
    );

    expect(stale).toEqual([]);
  });
});
