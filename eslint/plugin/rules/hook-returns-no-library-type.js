const ts = require('typescript');

/**
 * Types that couple a screen to Apollo. The import boundary keeps the client
 * out of what renders; this is the other half — a hook can hold the client
 * correctly and still hand back one of these.
 */
const BANNED = [
  'ApolloError',
  'ApolloClient',
  'ApolloCache',
  'ApolloQueryResult',
  'InMemoryCache',
  'NetworkStatus',
  'ObservableQuery',
  'FetchResult',
  'MutationResult',
  'QueryResult',
  'SubscriptionResult',
];

const FORMAT =
  ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'A feature hook hands a screen no library type.',
      url: 'docs/rules/hook-returns-no-library-type.md',
    },
    schema: [],
    messages: {
      libraryType:
        '`{{hook}}` hands back `{{banned}}`. A screen that destructures it is coupled to Apollo by TYPE while importing nothing, so the import boundary cannot see it. Return plain values and callbacks: a message rather than an `ApolloError`, a boolean rather than a `NetworkStatus`, what `settleMutation` settled rather than a result object.',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program) return {};
    const checker = services.program.getTypeChecker();

    /** The type itself plus each property one level down, where a leak shows. */
    const render = (type, node) =>
      [
        checker.typeToString(type, node, FORMAT),
        ...checker
          .getPropertiesOfType(type)
          .map(property =>
            checker.typeToString(
              checker.getTypeOfSymbolAtLocation(property, node),
              node,
              FORMAT,
            ),
          ),
      ].join('\n');

    const check = (node, name) => {
      if (!/^use[A-Z]/.test(name)) return;
      const tsNode = services.esTreeNodeToTSNodeMap.get(node);
      const identifier = tsNode?.name;
      if (!identifier) return;
      const symbol = checker.getSymbolAtLocation(identifier);
      if (!symbol) return;
      const [signature] = checker
        .getTypeOfSymbolAtLocation(symbol, tsNode)
        .getCallSignatures();
      if (!signature) return;

      const rendered = render(
        checker.getReturnTypeOfSignature(signature),
        tsNode,
      );
      for (const banned of BANNED) {
        if (new RegExp(`\\b${banned}\\b`).test(rendered)) {
          context.report({
            node,
            messageId: 'libraryType',
            data: { hook: name, banned },
          });
          return;
        }
      }
    };

    return {
      'ExportNamedDeclaration > FunctionDeclaration'(node) {
        if (node.id) check(node, node.id.name);
      },
      'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator'(
        node,
      ) {
        if (node.id.type === 'Identifier') check(node, node.id.name);
      },
    };
  },
};
