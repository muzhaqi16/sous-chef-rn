const ts = require('typescript');

const TRANSLATE_FUNCTIONS = new Set(['t', 'tGlobal', 'translate']);

const isTranslateCall = call => {
  const callee = call.callee;
  if (callee.type === 'Identifier') return TRANSLATE_FUNCTIONS.has(callee.name);
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 't'
  );
};

const isStringExpression = node =>
  (node.type === 'Literal' && typeof node.value === 'string') ||
  node.type === 'TemplateLiteral';

const keyName = property => {
  if (property.type !== 'Property' || property.computed) return undefined;
  if (property.key.type === 'Identifier') return property.key.name;
  return typeof property.key.value === 'string'
    ? property.key.value
    : undefined;
};

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A translation call carries no inline fallback copy: the key resolves in every locale.',
      url: 'docs/rules/no-t-default-value.md',
    },
    schema: [],
    messages: {
      defaultValue:
        '`defaultValue` is English copy that renders in every locale whenever the key is missing, which hides the missing key. Declare the key in the owning en.json (and es/it/sq) and drop the fallback.',
      stringFallback:
        'A string second argument to `t` is a fallback that renders in every locale when the key is missing, which hides the missing key. Declare the key in the owning en.json (and es/it/sq) and drop the fallback.',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    const checker = services?.program?.getTypeChecker();

    // A variable fallback (`t(key, serverMessage)`) is found by its type.
    const isStringTyped = node => {
      if (!checker) return false;
      const type = checker.getTypeAtLocation(
        services.esTreeNodeToTSNodeMap.get(node),
      );
      return (type.isUnion() ? type.types : [type]).some(
        part => (part.flags & ts.TypeFlags.StringLike) !== 0,
      );
    };

    return {
      CallExpression(node) {
        if (!isTranslateCall(node)) return;
        const [, second, third] = node.arguments;
        if (second && (isStringExpression(second) || isStringTyped(second))) {
          context.report({ node: second, messageId: 'stringFallback' });
        }
        for (const options of [second, third]) {
          if (options?.type !== 'ObjectExpression') continue;
          for (const property of options.properties) {
            if (keyName(property) === 'defaultValue') {
              context.report({ node: property, messageId: 'defaultValue' });
            }
          }
        }
      },
    };
  },
};
