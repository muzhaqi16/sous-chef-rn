const ts = require('typescript');

const QUANTITY_NAME = /quantity|amount|qty/i;
const ARITHMETIC = new Set(['+', '-', '*', '/', '%']);
// i18next selects the plural form from `count`, so it must stay a number.
const PLURAL_KEY = 'count';

const nameOf = node => {
  if (node.type === 'Identifier') return node.name;
  if (node.type !== 'MemberExpression') return undefined;
  if (!node.computed) return node.property.name;
  return node.property.type === 'Literal'
    ? String(node.property.value)
    : undefined;
};

const isTranslateCall = node =>
  (node.callee.type === 'Identifier' &&
    (node.callee.name === 't' || node.callee.name === 'tGlobal')) ||
  (node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.name === 't');

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A quantity reaches the screen through formatQuantityForDisplay, never as a raw number.',
      url: 'docs/rules/quantity-through-formatter.md',
    },
    schema: [
      {
        type: 'object',
        properties: { followVariables: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    messages: {
      rawQuantity:
        '`{{name}}` is a raw number reaching the screen, so 1.25 reads "1.25" and a converted 177.4412 reads "177.4412". Render it through `QuantityDisplay`, `formatQuantityForDisplay` or `formatQuantityDisplay` (`#/utils/formatQuantity`).',
      rawQuantityVariable:
        '`{{name}}` carries the raw number `{{source}}` to the screen, so 1.25 reads "1.25" and a converted 177.4412 reads "177.4412". Format it where the `const` is built: `formatQuantityForDisplay`, `formatQuantityDisplay` or `QuantityDisplay` (`#/utils/formatQuantity`).',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program) return {};
    const checker = services.program.getTypeChecker();
    const followVariables = context.options[0]?.followVariables ?? false;
    const sourceCode = context.sourceCode;

    const typeParts = node => {
      const type = checker.getTypeAtLocation(
        services.esTreeNodeToTSNodeMap.get(node),
      );
      return type.isUnion() ? type.types : [type];
    };

    const isNumber = node => {
      const present = typeParts(node).filter(
        part => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)),
      );
      return (
        present.length > 0 &&
        present.every(part => part.flags & ts.TypeFlags.NumberLike)
      );
    };

    const isString = node =>
      typeParts(node).every(
        part =>
          part.flags &
          (ts.TypeFlags.StringLike |
            ts.TypeFlags.Null |
            ts.TypeFlags.Undefined),
      );

    const report = node =>
      context.report({
        node,
        messageId: 'rawQuantity',
        data: { name: sourceCode.getText(node) },
      });

    /** The `const` initializer an identifier reads, when it has exactly one. */
    const constInitializer = identifier => {
      let scope = sourceCode.getScope(identifier);
      while (scope) {
        const variable = scope.set.get(identifier.name);
        if (variable) {
          const [definition, ...others] = variable.defs;
          if (
            others.length > 0 ||
            definition?.type !== 'Variable' ||
            definition.parent.kind !== 'const' ||
            definition.node.id.type !== 'Identifier'
          ) {
            return undefined;
          }
          return definition.node.init ?? undefined;
        }
        scope = scope.upper;
      }
      return undefined;
    };

    /**
     * The quantity-named numbers the rendered value is built from, each with the
     * rendered identifier it reached output through when a `const` was followed.
     */
    const sources = (node, seen) => {
      switch (node.type) {
        case 'Identifier':
        case 'MemberExpression': {
          const name = nameOf(node);
          if (name && QUANTITY_NAME.test(name) && isNumber(node)) {
            return [{ source: node, via: null }];
          }
          if (!followVariables || node.type !== 'Identifier') return [];
          const init = constInitializer(node);
          if (!init || seen.has(init)) return [];
          seen.add(init);
          return sources(init, seen)
            .slice(0, 1)
            .map(({ source }) => ({ source, via: node }));
        }
        case 'ChainExpression':
        case 'TSNonNullExpression':
        case 'TSAsExpression':
          return sources(node.expression, seen);
        case 'TemplateLiteral':
          return node.expressions.flatMap(part => sources(part, seen));
        case 'ConditionalExpression':
          return [
            ...sources(node.consequent, seen),
            ...sources(node.alternate, seen),
          ];
        case 'LogicalExpression':
          // `qty && <X />` renders the right side; the left is a guard.
          return [
            ...(node.operator === '&&' ? [] : sources(node.left, seen)),
            ...sources(node.right, seen),
          ];
        case 'BinaryExpression':
          return ARITHMETIC.has(node.operator)
            ? [...sources(node.left, seen), ...sources(node.right, seen)]
            : [];
        case 'UnaryExpression':
          return node.operator === '-' || node.operator === '+'
            ? sources(node.argument, seen)
            : [];
        default:
          // A call's result is its own formatting; anything else is not text.
          return [];
      }
    };

    /** Reports each quantity-named number the rendered value is built from. */
    const check = node => {
      for (const { source, via } of sources(node, new Set())) {
        if (!via) {
          report(source);
          continue;
        }
        context.report({
          node: via,
          messageId: 'rawQuantityVariable',
          data: {
            name: sourceCode.getText(via),
            source: sourceCode.getText(source),
          },
        });
      }
    };

    return {
      JSXExpressionContainer(node) {
        if (node.expression.type === 'JSXEmptyExpression') return;
        const parent = node.parent;
        if (parent.type === 'JSXElement' || parent.type === 'JSXFragment') {
          check(node.expression);
        } else if (
          parent.type === 'JSXAttribute' &&
          isString(node.expression)
        ) {
          // A number-typed prop is handed on as a number, not shown.
          check(node.expression);
        }
      },
      CallExpression(node) {
        if (!isTranslateCall(node)) return;
        const options = node.arguments[1];
        if (options?.type !== 'ObjectExpression') return;
        for (const property of options.properties) {
          if (property.type !== 'Property') continue;
          if (!property.computed && nameOf(property.key) === PLURAL_KEY)
            continue;
          check(property.value);
        }
      },
    };
  },
};
