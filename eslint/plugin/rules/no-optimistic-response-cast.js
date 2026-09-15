const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-optimistic-response-cast',
  description:
    'An optimisticResponse is built from the cache, not a cast { __typename, … } literal.',
  checks: [
    {
      messageId: 'castPartialEntity',
      selector:
        'Property[key.name="optimisticResponse"] TSAsExpression > ObjectExpression:has(Property[key.name="__typename"])',
      message:
        "Hand-rolled `{ __typename, id, ... } as TData['field']` shapes inside `optimisticResponse` write partial entities to the cache and break data-masking watchers (useFragment returns `complete: false` → phantom rows in lists). Read the current entity via `client.cache.readFragment(...)` (returning IGNORE when absent) and annotate the callback's return type as `Unmasked<TData>` so no cast is needed. See CLAUDE.md \"Apollo Mutation Patterns\" + `usePantryItemMutations.ts:updateItemMutation` for the pattern.",
    },
  ],
});
