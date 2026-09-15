const SEARCH_METHODS = new Set([
  'includes',
  'startsWith',
  'endsWith',
  'match',
  'matchAll',
  'indexOf',
  'lastIndexOf',
  'search',
]);
const PASS_THROUGH_METHODS = new Set([
  'toLowerCase',
  'toUpperCase',
  'toLocaleLowerCase',
  'toLocaleUpperCase',
  'trim',
  'normalize',
  'toString',
]);

const MESSAGE_NAME = /^(error|err)?(message|msg)$/i;

const isTextLiteral = node =>
  (node.type === 'Literal' && typeof node.value === 'string') ||
  node.type === 'TemplateLiteral';

const unwrap = node => {
  let current = node;
  while (
    current?.type === 'ChainExpression' ||
    current?.type === 'TSNonNullExpression'
  ) {
    current = current.expression;
  }
  return current;
};

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'An error is classified by its code, never by its message text.',
      url: 'docs/rules/no-error-message-branching.md',
    },
    schema: [],
    messages: {
      messageBranch:
        "Branching on an error's `message` text breaks when the wording changes, and a server message is unlocalized English. Branch on its `code` (`ErrorCode` / `TopLevelErrorCode`, `extensions.code`, a refusal's `code` and `field`), or on the error's class.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    const isMessageExpression = (raw, seen = new Set()) => {
      const node = unwrap(raw);
      if (!node) return false;
      switch (node.type) {
        case 'MemberExpression':
          return !node.computed && node.property.name === 'message';
        case 'CallExpression': {
          const callee = unwrap(node.callee);
          if (
            callee?.type === 'MemberExpression' &&
            !callee.computed &&
            PASS_THROUGH_METHODS.has(callee.property.name)
          ) {
            return isMessageExpression(callee.object, seen);
          }
          if (callee?.type === 'Identifier' && callee.name === 'String') {
            return node.arguments.some(arg => isMessageExpression(arg, seen));
          }
          return false;
        }
        case 'ConditionalExpression':
          return (
            isMessageExpression(node.consequent, seen) ||
            isMessageExpression(node.alternate, seen)
          );
        case 'LogicalExpression':
          return (
            isMessageExpression(node.left, seen) ||
            isMessageExpression(node.right, seen)
          );
        case 'Identifier': {
          if (seen.has(node.name)) return false;
          seen.add(node.name);
          const variable = findVariable(sourceCode.getScope(node), node.name);
          const def = variable?.defs[0];
          if (!def) return false;
          // A parameter carrying an error's text by name: `isCacheError(message)`.
          if (def.type === 'Parameter') return MESSAGE_NAME.test(node.name);
          if (def.type !== 'Variable' || def.node.init == null) return false;
          // `const { message } = error`
          if (def.node.id.type === 'ObjectPattern') {
            return def.node.id.properties.some(
              property =>
                property.type === 'Property' &&
                !property.computed &&
                property.key.name === 'message' &&
                property.value.type === 'Identifier' &&
                property.value.name === node.name,
            );
          }
          return isMessageExpression(def.node.init, seen);
        }
        default:
          return false;
      }
    };

    const report = node => context.report({ node, messageId: 'messageBranch' });

    return {
      BinaryExpression(node) {
        if (!['===', '!==', '==', '!='].includes(node.operator)) return;
        // Against wording only: a nullish check or two messages compared to
        // each other (de-duplicating alerts) branches on no text.
        if (
          (isMessageExpression(node.left) && isTextLiteral(node.right)) ||
          (isMessageExpression(node.right) && isTextLiteral(node.left))
        ) {
          report(node);
        }
      },
      CallExpression(node) {
        const callee = unwrap(node.callee);
        if (callee?.type !== 'MemberExpression' || callee.computed) return;
        const method = callee.property.name;
        if (SEARCH_METHODS.has(method) && isMessageExpression(callee.object)) {
          report(node);
        } else if (
          (method === 'test' || method === 'exec') &&
          node.arguments.some(arg => isMessageExpression(arg))
        ) {
          report(node);
        }
      },
      SwitchStatement(node) {
        if (isMessageExpression(node.discriminant)) report(node.discriminant);
      },
    };
  },
};

function findVariable(scope, name) {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name);
    if (variable) return variable;
  }
  return undefined;
}
