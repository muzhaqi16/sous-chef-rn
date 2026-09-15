const SPACING =
  /^(padding|margin)(Top|Bottom|Left|Right|Horizontal|Vertical|Start|End)?$|^(gap|rowGap|columnGap)$/;

const numberOf = node => {
  if (node.type === 'Literal' && typeof node.value === 'number') {
    return node.value;
  }
  if (
    node.type === 'UnaryExpression' &&
    node.operator === '-' &&
    node.argument.type === 'Literal' &&
    typeof node.argument.value === 'number'
  ) {
    return -node.argument.value;
  }
  return undefined;
};

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Padding, margin and gap are spacing tokens, never a non-zero number.',
      url: 'docs/rules/no-raw-spacing.md',
    },
    schema: [],
    messages: {
      rawSpacing:
        'A raw number does not scale with the density setting. Use a `theme.spacing.*` step (or `theme.layout.*` for a named layout step); a missing step is added to `src/theme/foundations/spacing.ts`, never written at the call site.',
    },
  },
  create(context) {
    return {
      Property(node) {
        if (node.computed) return;
        const key =
          node.key.type === 'Identifier' ? node.key.name : node.key.value;
        if (typeof key !== 'string' || !SPACING.test(key)) return;
        const value = numberOf(node.value);
        if (value !== undefined && value !== 0) {
          context.report({ node: node.value, messageId: 'rawSpacing' });
        }
      },
    };
  },
};
