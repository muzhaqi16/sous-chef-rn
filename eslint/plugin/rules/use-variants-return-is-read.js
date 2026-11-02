const { variableNamed, variantSheetOf } = require('../variantSheets');

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Variants are read from the styles `useVariants` returns, never from the sheet.',
      url: 'docs/rules/use-variants-return-is-read.md',
    },
    schema: [],
    messages: {
      bareCall:
        '`{{sheet}}.useVariants()` returns the styles with these variants; without the Babel plugin a bare call changes nothing. Write `const variantStyles = {{sheet}}.useVariants({ … })`.',
      sheetRead:
        '`{{sheet}}` ignores the variants selected above it. Read this from the styles `useVariants` returned.',
    },
  },
  create(context) {
    const { sourceCode } = context;

    return {
      'ExpressionStatement > CallExpression[callee.property.name="useVariants"]'(
        node,
      ) {
        context.report({
          node,
          messageId: 'bareCall',
          data: { sheet: sourceCode.getText(node.callee.object) },
        });
      },

      VariableDeclarator(node) {
        const sheet = variantSheetOf(node.init);
        if (!sheet) return;
        const scope = sourceCode.getScope(node);
        const functionEnd = scope.variableScope.block.range[1];

        for (const { identifier } of variableNamed(sheet, scope)?.references ??
          []) {
          const { parent } = identifier;
          if (
            identifier.range[0] > node.range[1] &&
            identifier.range[0] < functionEnd &&
            parent.type !== 'TSTypeQuery' &&
            parent.property?.name !== 'useVariants'
          ) {
            context.report({
              node: identifier,
              messageId: 'sheetRead',
              data: { sheet },
            });
          }
        }
      },
    };
  },
};
