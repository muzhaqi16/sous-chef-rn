const { getNamedType, isInterfaceType, isObjectType } = require('graphql');
const { REMOVAL } = require('../../../scripts/lib/removalField');

const VERSION = 'version';
const KEY_FIELDS = new Set(['id', '__typename']);

/** Per document set: every fragment an operation spreads, at any depth. */
const reachableBySiblings = new WeakMap();

const reachableFragments = siblings => {
  let names = reachableBySiblings.get(siblings);
  if (!names) {
    names = new Set();
    for (const { document } of siblings.getOperations()) {
      for (const fragment of siblings.getFragmentsInUse(document, true)) {
        names.add(fragment.name.value);
      }
    }
    reachableBySiblings.set(siblings, names);
  }
  return names;
};

/**
 * A direct, unaliased `version`, or one an inline fragment or a spread brings:
 * the answer carries it under its own name either way.
 */
const selectsVersion = (selectionSet, siblings, seen = new Set()) =>
  selectionSet.selections.some(selection => {
    if (selection.kind === 'Field') {
      return selection.name.value === VERSION && !selection.alias;
    }
    if (selection.kind === 'InlineFragment') {
      return selectsVersion(selection.selectionSet, siblings, seen);
    }
    if (selection.kind !== 'FragmentSpread') return false;
    const name = selection.name.value;
    if (seen.has(name)) return false;
    seen.add(name);
    const [found] = siblings.getFragment(name);
    return found
      ? selectsVersion(found.document.selectionSet, siblings, seen)
      : false;
  });

const definitionOf = node => {
  let current = node.parent;
  while (
    current &&
    current.kind !== 'OperationDefinition' &&
    current.kind !== 'FragmentDefinition'
  ) {
    current = current.parent;
  }
  return current;
};

const rootFieldOf = (node, definition) => {
  let current = node;
  while (current.parent.parent !== definition) current = current.parent;
  return current;
};

/** The key of a row a removal returns: the client evicts it, unread. */
const isRemovedKey = (node, definition) =>
  definition?.operation === 'mutation' &&
  REMOVAL.test(rootFieldOf(node, definition).name.value) &&
  node.selections.every(
    selection =>
      selection.kind === 'Field' && KEY_FIELDS.has(selection.name.value),
  );

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'A selection on a type with a server `version` that reaches the network selects `version`.',
      url: 'docs/rules/network-read-selects-version.md',
    },
    schema: [],
    messages: {
      missingVersion:
        '`{{type}}` reaches the network here without `version`, so `answerOrderingLink` cannot tell whether this answer is older than the row the device holds. Select `version` (the autofix adds it). A fragment no operation spreads is exempt: it only writes the cache.',
    },
  },
  create(context) {
    const { siblingOperations } = context.sourceCode.parserServices;
    if (!siblingOperations?.available) return {};
    return {
      SelectionSet(node) {
        const definition = definitionOf(node);
        if (
          definition?.kind === 'FragmentDefinition' &&
          !reachableFragments(siblingOperations).has(definition.name.value)
        ) {
          return;
        }
        const type = getNamedType(node.typeInfo().gqlType);
        if (!(isObjectType(type) || isInterfaceType(type))) return;
        if (!(VERSION in type.getFields())) return;
        if (selectsVersion(node, siblingOperations)) return;
        if (isRemovedKey(node, definition)) return;
        const [first] = node.selections;
        context.report({
          node,
          messageId: 'missingVersion',
          data: { type: type.name },
          fix: first
            ? fixer => {
                const { text } = context.sourceCode;
                const [start] = first.range;
                const before = text.slice(
                  text.lastIndexOf('\n', start - 1) + 1,
                  start,
                );
                // Its own line beside the first selection; inline in `{ id }`.
                return fixer.insertTextBefore(
                  first,
                  /^\s*$/.test(before)
                    ? `${VERSION}\n${before}`
                    : `${VERSION} `,
                );
              }
            : null,
        });
      },
    };
  },
};
