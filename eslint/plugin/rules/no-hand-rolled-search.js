const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-hand-rolled-search',
  description:
    'Search a loaded list through filterByTerm, not a hand-rolled toLowerCase().includes().',
  checks: [
    {
      messageId: 'handRolledSearch',
      selector:
        "CallExpression[callee.property.name='filter'] CallExpression[callee.property.name='includes'][callee.object.callee.property.name='toLowerCase']",
      message:
        'Use filterByTerm / matchesTerm from #hooks/search/useLocalSearch for a list search, or searchUtils for the fuzzy variant. A hand-rolled filter re-decides what an empty term, a null field and whitespace mean.',
    },
  ],
});
