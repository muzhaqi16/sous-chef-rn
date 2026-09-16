const path = require('node:path');

const GENERATED_DIR = `${path.sep}src${path.sep}graphql${path.sep}generated${path.sep}`;
const LIBRARY_DIRS = [
  `${path.sep}node_modules${path.sep}@apollo${path.sep}client${path.sep}`,
  `${path.sep}node_modules${path.sep}graphql${path.sep}`,
];

// These extend `Error`, so their `message` is declared by the TS lib; the
// class itself is what marks the text as the server's.
const LIBRARY_ERROR_TYPES = new Set([
  'CombinedGraphQLErrors',
  'CombinedProtocolErrors',
  'ServerError',
  'ServerParseError',
  'GraphQLError',
  'GraphQLFormattedError',
  'ErrorLike',
]);

/**
 * Fields other than `message` that carry copy the server writes in English.
 * Each row is evidenced in the rule doc's audit table; a field a person types
 * (a name, a note, a list's description) does not belong here.
 */
const SERVER_COPY_FIELDS = [
  { typeName: 'Notification', fieldName: 'title' },
  { typeName: 'UserEvent', fieldName: 'reason' },
  { typeName: 'MyModerationStatus', fieldName: 'banReason' },
  { typeName: 'MyModerationStatus', fieldName: 'suspensionReason' },
  { typeName: 'MyModerationStatus', fieldName: 'restrictionReason' },
  { typeName: 'ShoppingListItemSource', fieldName: 'autoAddReason' },
  { typeName: 'LedgerPeriodData', fieldName: 'periodLabel' },
  { typeName: 'AggregationResult', fieldName: 'displayText' },
  { typeName: 'ConversionResult', fieldName: 'displayText' },
  { typeName: 'BatchAddShoppingListItemResult', fieldName: 'error' },
  { typeName: 'BatchUpsertItemResult', fieldName: 'error' },
  { typeName: 'ConsumptionFailure', fieldName: 'reason' },
  { typeName: 'FailedMoveInfo', fieldName: 'reason' },
  { typeName: 'SkippedLowStockItem', fieldName: 'reason' },
  { typeName: 'SkippedRecipeIngredient', fieldName: 'reason' },
  { typeName: 'DuplicatePantryItemError', fieldName: 'suggestion' },
  { typeName: 'ItemValidationWarning', fieldName: 'suggestion' },
  { typeName: 'ShoppingListActivity', fieldName: 'description' },
  { typeName: 'InviteLog', fieldName: 'description' },
];

const SERVER_COPY_TYPES_BY_FIELD = SERVER_COPY_FIELDS.reduce(
  (byField, { typeName, fieldName }) => {
    const typeNames = byField.get(fieldName) ?? new Set();
    typeNames.add(typeName);
    return byField.set(fieldName, typeNames);
  },
  new Map(),
);

const PASS_THROUGH_METHODS = new Set([
  'trim',
  'toString',
  'toUpperCase',
  'toLowerCase',
  'toLocaleUpperCase',
  'toLocaleLowerCase',
  'normalize',
  'concat',
  'slice',
  'substring',
]);

const SINK_SERVICES = /^(toastService|alertService)$/;
const TRANSLATE_FUNCTIONS = /^(t|tGlobal)$/;

const isGeneratedFile = fileName =>
  fileName.includes(GENERATED_DIR) || fileName.endsWith('.generated.ts');
const isLibraryFile = fileName =>
  LIBRARY_DIRS.some(dir => fileName.includes(dir));

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "A server error's `message`, or other copy the server writes, never reaches the screen.",
      url: 'docs/rules/no-rendered-server-message.md',
    },
    schema: [
      {
        type: 'object',
        properties: { followProjections: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    messages: {
      renderedServerMessage:
        'This `message` comes from the server (a generated schema type or an Apollo/GraphQL error) and reaches rendered output. It is unlocalized English. Build the copy from the typed fields (`code`, `field`, an enum like `type`) through `t(…)`, or resolve an error with `localizedErrorMessage(error, fallback)` / `settleMutation`.',
      renderedServerCopy:
        '`{{typeName}}.{{fieldName}}` is copy the server writes in English, and it reaches rendered output. Build the text from the structured fields beside it (a `type` or `code` enum, names, counts, dates) through `t(…)`.',
      renderedServerMessageProjected:
        'This `message` comes from the server and is stored in an object property that this file renders. It is unlocalized English. Build the copy from the typed fields (`code`, `field`, an enum like `type`) through `t(…)` where the projection is built, or resolve an error with `localizedErrorMessage(error, fallback)`.',
      renderedServerCopyProjected:
        '`{{typeName}}.{{fieldName}}` is copy the server writes in English, stored in an object property that this file renders. Build the text from the structured fields beside it (a `type` or `code` enum, names, counts, dates) through `t(…)` where the projection is built.',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program) return {};
    const checker = services.program.getTypeChecker();
    const sourceCode = context.sourceCode;
    const followProjections = context.options[0]?.followProjections ?? false;
    // Server copy stored as an object literal's property: `{ title: n.title }`.
    const projections = [];
    // Every non-computed property read, by name, to match against a projection.
    const propertyReads = new Map();

    const declaredInServerFile = symbol =>
      (symbol?.declarations ?? []).some(declaration => {
        const fileName = declaration.getSourceFile().fileName;
        return isGeneratedFile(fileName) || isLibraryFile(fileName);
      });

    const isServerType = type => {
      const parts = type.isUnion() ? type.types : [type];
      return parts.some(part => {
        for (const symbol of [part.getSymbol(), part.aliasSymbol]) {
          if (
            symbol &&
            LIBRARY_ERROR_TYPES.has(symbol.getName()) &&
            (symbol.declarations ?? []).some(declaration =>
              isLibraryFile(declaration.getSourceFile().fileName),
            )
          ) {
            return true;
          }
        }
        const members = part.isIntersection() ? part.types : [part];
        return members.some(member =>
          declaredInServerFile(checker.getPropertyOfType(member, 'message')),
        );
      });
    };

    const typenamesOf = type => {
      const symbol = checker.getPropertyOfType(type, '__typename');
      if (!symbol) return [];
      const typename = checker.getTypeOfSymbol(symbol);
      return (typename.isUnion() ? typename.types : [typename])
        .filter(part => part.isStringLiteral())
        .map(part => part.value);
    };

    /** The schema type whose server-written `fieldName` this object carries. */
    const serverCopyTypeName = (type, fieldName) => {
      const typeNames = SERVER_COPY_TYPES_BY_FIELD.get(fieldName);
      if (!typeNames) return null;
      const parts = type.isUnion() ? type.types : [type];
      for (const part of parts) {
        if (!declaredInServerFile(checker.getPropertyOfType(part, fieldName))) {
          continue;
        }
        const match = typenamesOf(part).find(name => typeNames.has(name));
        if (match) return match;
      }
      return null;
    };

    const typeOf = node =>
      checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node));

    const isSinkCall = call => {
      const callee = call.callee;
      return (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        SINK_SERVICES.test(callee.object.name)
      );
    };

    const isTranslateCall = call => {
      const callee = call.callee;
      if (callee.type === 'Identifier')
        return TRANSLATE_FUNCTIONS.test(callee.name);
      return (
        callee.type === 'MemberExpression' &&
        !callee.computed &&
        callee.property.name === 't'
      );
    };

    /** Whether the value at `start` flows, unchanged or composed, into output; the object properties it is stored in on the way are pushed to `projectionTarget`. */
    const reachesOutput = (start, seen, projectionTarget) => {
      let current = start;
      for (;;) {
        const parent = current.parent;
        if (!parent) return false;
        switch (parent.type) {
          case 'ChainExpression':
          case 'TSNonNullExpression':
          case 'TemplateLiteral':
          case 'ArrayExpression':
            break;
          case 'LogicalExpression':
            // `message && <Fixed />` renders the right side only.
            if (parent.operator === '&&' && parent.left === current) {
              return false;
            }
            break;
          case 'ConditionalExpression':
            if (parent.test === current) return false;
            break;
          case 'BinaryExpression':
            if (parent.operator !== '+') return false;
            break;
          case 'Property':
            if (parent.value !== current) return false;
            if (
              followProjections &&
              projectionTarget &&
              parent.parent.type === 'ObjectExpression' &&
              !parent.computed &&
              parent.key.type === 'Identifier'
            ) {
              projectionTarget.push(parent);
            }
            break;
          case 'ObjectExpression':
            break;
          case 'MemberExpression': {
            const call = parent.parent;
            if (
              parent.object !== current ||
              parent.computed ||
              !PASS_THROUGH_METHODS.has(parent.property.name) ||
              call?.type !== 'CallExpression' ||
              call.callee !== parent
            ) {
              return false;
            }
            current = call;
            continue;
          }
          case 'CallExpression':
            if (parent.callee === current) return false;
            if (isSinkCall(parent)) return true;
            if (
              !isTranslateCall(parent) &&
              !(
                parent.callee.type === 'Identifier' &&
                parent.callee.name === 'String'
              )
            ) {
              return false;
            }
            break;
          case 'JSXExpressionContainer': {
            const holder = parent.parent;
            if (holder.type === 'JSXElement' || holder.type === 'JSXFragment') {
              return true;
            }
            return holder.type === 'JSXAttribute' && holder.name.name !== 'key';
          }
          case 'VariableDeclarator':
            return (
              parent.init === current &&
              parent.id.type === 'Identifier' &&
              bindingReachesOutput(
                parent,
                parent.id.name,
                seen,
                projectionTarget,
              )
            );
          default:
            return false;
        }
        current = parent;
      }
    };

    const bindingReachesOutput = (declarator, name, seen, projectionTarget) => {
      const variable = sourceCode
        .getDeclaredVariables(declarator)
        .find(candidate => candidate.name === name);
      if (!variable || seen.has(variable)) return false;
      seen.add(variable);
      return variable.references.some(
        reference =>
          !reference.init &&
          reachesOutput(reference.identifier, seen, projectionTarget),
      );
    };

    const declarationsOf = symbol => new Set(symbol?.declarations ?? []);

    /**
     * The declarations a read of the projected property resolves to: the
     * literal's own property, and the app-declared property it is typed by.
     */
    const projectedDeclarations = property => {
      const tsProperty = services.esTreeNodeToTSNodeMap.get(property);
      const declarations = new Set([tsProperty]);
      const contextual = checker.getContextualType(
        services.esTreeNodeToTSNodeMap.get(property.parent),
      );
      const parts = contextual?.isUnion() ? contextual.types : [contextual];
      for (const part of parts) {
        if (!part) continue;
        for (const declaration of declarationsOf(
          checker.getPropertyOfType(part, property.key.name),
        )) {
          const fileName = declaration.getSourceFile().fileName;
          if (
            !isGeneratedFile(fileName) &&
            !fileName.includes('node_modules')
          ) {
            declarations.add(declaration);
          }
        }
      }
      return declarations;
    };

    const variableReachesOutput = identifier => {
      let scope = sourceCode.getScope(identifier);
      while (scope) {
        const variable = scope.set.get(identifier.name);
        if (variable) {
          return variable.references.some(
            reference =>
              !reference.init &&
              reachesOutput(reference.identifier, new Set([variable]), null),
          );
        }
        scope = scope.upper;
      }
      return false;
    };

    /** A read of `name` that resolves to one of `declarations` and reaches output. */
    const projectionIsRendered = (name, declarations) =>
      (propertyReads.get(name) ?? []).some(read => {
        const symbol =
          read.type === 'MemberExpression'
            ? checker.getSymbolAtLocation(
                services.esTreeNodeToTSNodeMap.get(read.property),
              )
            : checker.getPropertyOfType(typeOf(read.parent), name);
        if (![...declarationsOf(symbol)].some(d => declarations.has(d))) {
          return false;
        }
        if (read.type === 'MemberExpression') {
          return reachesOutput(read, new Set(), null);
        }
        const binding =
          read.value.type === 'AssignmentPattern'
            ? read.value.left
            : read.value;
        return binding.type === 'Identifier' && variableReachesOutput(binding);
      });

    /** The report for reading `fieldName` off `object`'s type, or null. */
    const findingFor = (objectType, fieldName) => {
      if (fieldName === 'message') {
        return isServerType(objectType)
          ? { messageId: 'renderedServerMessage' }
          : null;
      }
      const typeName = serverCopyTypeName(objectType, fieldName);
      return typeName
        ? { messageId: 'renderedServerCopy', data: { typeName, fieldName } }
        : null;
    };

    const addRead = (name, read) => {
      const reads = propertyReads.get(name) ?? [];
      reads.push(read);
      propertyReads.set(name, reads);
    };

    const isWatchedField = name =>
      name === 'message' || SERVER_COPY_TYPES_BY_FIELD.has(name);

    return {
      MemberExpression(node) {
        if (node.computed || node.property.type !== 'Identifier') return;
        if (followProjections) addRead(node.property.name, node);
        if (!isWatchedField(node.property.name)) return;
        const finding = findingFor(typeOf(node.object), node.property.name);
        if (!finding) return;
        const stored = [];
        if (reachesOutput(node, new Set(), stored)) {
          context.report({ node, ...finding });
        } else if (stored.length > 0) {
          projections.push({ node, finding, properties: stored });
        }
      },
      // `const { message } = error`, then rendered.
      VariableDeclarator(node) {
        if (node.id.type !== 'ObjectPattern' || !node.init) return;
        const properties = node.id.properties.filter(
          candidate =>
            candidate.type === 'Property' &&
            !candidate.computed &&
            candidate.key.type === 'Identifier' &&
            isWatchedField(candidate.key.name) &&
            candidate.value.type === 'Identifier',
        );
        if (properties.length === 0) return;
        const initType = typeOf(node.init);
        for (const property of properties) {
          const finding = findingFor(initType, property.key.name);
          if (!finding) continue;
          const stored = [];
          if (
            bindingReachesOutput(node, property.value.name, new Set(), stored)
          ) {
            context.report({ node: property, ...finding });
          } else if (stored.length > 0) {
            projections.push({ node: property, finding, properties: stored });
          }
        }
      },
      ObjectPattern(node) {
        if (!followProjections) return;
        for (const property of node.properties) {
          if (
            property.type === 'Property' &&
            !property.computed &&
            property.key.type === 'Identifier'
          ) {
            addRead(property.key.name, property);
          }
        }
      },
      'Program:exit'() {
        for (const { node, finding, properties } of projections) {
          const rendered = properties.some(property =>
            projectionIsRendered(
              property.key.name,
              projectedDeclarations(property),
            ),
          );
          if (rendered) {
            context.report({
              node,
              messageId: `${finding.messageId}Projected`,
              data: finding.data,
            });
          }
        }
      },
    };
  },
};
