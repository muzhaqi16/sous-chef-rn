const { getNamedType, isInterfaceType, isObjectType } = require('graphql');

const KEY_FIELD = 'id';

/**
 * A direct `id`, or one in an inline fragment, which masking does not hide.
 * An aliased `id` does not count: the key field is read by its own name.
 */
const selectsKeyField = selectionSet =>
  selectionSet.selections.some(selection =>
    selection.kind === 'Field'
      ? (selection.alias ?? selection.name).value === KEY_FIELD &&
        selection.name.value === KEY_FIELD
      : selection.kind === 'InlineFragment' &&
        selectsKeyField(selection.selectionSet),
  );

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A selection set that spreads a fragment on a type with an `id` selects `id` itself.',
      url: 'docs/rules/selects-key-field-directly.md',
    },
    schema: [],
    messages: {
      keyFieldOnlyInSpread:
        "`{{field}}` reaches `id` only through a fragment spread. Under `dataMasking` the spread is hidden from this selection, so the object it hands on carries `__typename` alone, and `cache.identify` / `useFragment` throw `Missing field 'id'`. Select `id` here as well — it is already fetched. `@graphql-eslint/require-selections` follows the spread and cannot see this.",
    },
  },
  create(context) {
    return {
      'SelectionSet[parent.kind!=/^(OperationDefinition|InlineFragment)$/]'(
        node,
      ) {
        if (!node.selections.some(s => s.kind === 'FragmentSpread')) return;
        if (selectsKeyField(node)) return;
        const type = getNamedType(node.typeInfo().gqlType);
        if (!(isObjectType(type) || isInterfaceType(type))) return;
        if (!(KEY_FIELD in type.getFields())) return;
        context.report({
          node,
          messageId: 'keyFieldOnlyInSpread',
          data: {
            field: node.parent.alias?.value ?? node.parent.name.value,
          },
        });
      },
    };
  },
};
