const ts = require('typescript');

// Tables here are fixtures, resources or codegen output, not lookups.
const EXEMPT_FILE =
  /(^|[\\/])(__tests__|__mocks__|e2e|generated|locales|i18n)[\\/]|\.(test|spec|generated)\.[jt]sx?$/;

const OPAQUE_VALUE =
  ts.TypeFlags.Unknown | ts.TypeFlags.Any | ts.TypeFlags.Never;
const LITERAL_KEY =
  ts.TypeFlags.StringLiteral |
  ts.TypeFlags.NumberLiteral |
  ts.TypeFlags.EnumLiteral;
const NULLISH = ts.TypeFlags.Undefined | ts.TypeFlags.Null;
const MUTATING_MAP_METHODS = new Set(['set', 'delete', 'clear']);
const READING_MAP_METHODS = new Set(['get', 'has']);
const MUTATING_OBJECT_CALLS = new Set([
  'assign',
  'defineProperty',
  'setPrototypeOf',
]);
const MAX_SUGGESTION_LENGTH = 80;

const unwrap = node => {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
};

/** The outermost node standing for a reference once `(…)` and `!` around it are counted. */
const outermost = node => {
  let current = node;
  while (
    ts.isParenthesizedExpression(current.parent) ||
    ts.isNonNullExpression(current.parent)
  ) {
    current = current.parent;
  }
  return current;
};

const isWriteTarget = node => {
  const target = outermost(node);
  const { parent } = target;
  if (ts.isDeleteExpression(parent)) return true;
  if (
    (ts.isPrefixUnaryExpression(parent) ||
      ts.isPostfixUnaryExpression(parent)) &&
    (parent.operator === ts.SyntaxKind.PlusPlusToken ||
      parent.operator === ts.SyntaxKind.MinusMinusToken)
  ) {
    return true;
  }
  return (
    ts.isBinaryExpression(parent) &&
    parent.left === target &&
    parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  );
};

/** `Object.assign(x, …)`-style calls, with the name of the helper. */
const objectHelperName = call =>
  ts.isPropertyAccessExpression(call.expression) &&
  ts.isIdentifier(call.expression.expression) &&
  call.expression.expression.text === 'Object'
    ? call.expression.name.text
    : undefined;

function createAnalysis(program) {
  const checker = program.getTypeChecker();
  const cache = new WeakMap();

  const isStaticKey = name => {
    if (
      ts.isIdentifier(name) ||
      ts.isStringLiteral(name) ||
      ts.isNumericLiteral(name)
    ) {
      return true;
    }
    if (!ts.isComputedPropertyName(name)) return false;
    return (
      (checker.getTypeAtLocation(name.expression).flags & LITERAL_KEY) !== 0
    );
  };

  const isLiteralSyntax = node => {
    const key = unwrap(node);
    return ts.isStringLiteralLike(key) || ts.isNumericLiteral(key);
  };

  const isStaticExpressionKey = node =>
    isLiteralSyntax(node) ||
    (checker.getTypeAtLocation(unwrap(node)).flags & LITERAL_KEY) !== 0;

  const isClosedObject = node =>
    ts.isObjectLiteralExpression(node) &&
    node.properties.length > 0 &&
    node.properties.every(
      property =>
        (ts.isPropertyAssignment(property) ||
          ts.isShorthandPropertyAssignment(property) ||
          ts.isMethodDeclaration(property)) &&
        isStaticKey(property.name),
    );

  const isClosedMapConstruction = node => {
    if (
      !ts.isNewExpression(node) ||
      !ts.isIdentifier(node.expression) ||
      node.expression.text !== 'Map'
    ) {
      return false;
    }
    const [entries] = node.arguments ?? [];
    if (!entries || !ts.isArrayLiteralExpression(entries)) return false;
    return (
      entries.elements.length > 0 &&
      entries.elements.every(entry => {
        if (!ts.isArrayLiteralExpression(entry)) return false;
        const [key] = entry.elements;
        return (
          key !== undefined &&
          entry.elements.length === 2 &&
          isStaticExpressionKey(key)
        );
      })
    );
  };

  /** The value type behind a `string` key, or undefined when the type has none. */
  const stringKeyedValue = type => {
    const index = checker.getIndexInfoOfType(type, ts.IndexKind.String);
    if (index) return index.type;
    const symbol = type.getSymbol();
    if (!symbol || !['Map', 'ReadonlyMap'].includes(symbol.getName()))
      return undefined;
    const [key, value] = checker.getTypeArguments(type);
    if (!key || !value || (key.flags & ts.TypeFlags.String) === 0)
      return undefined;
    return value;
  };

  const isOpaque = type =>
    (type.isUnion() ? type.types : [type])
      .filter(part => (part.flags & NULLISH) === 0)
      .every(part => (part.flags & OPAQUE_VALUE) !== 0);

  /**
   * A named type declared in another module (a library's `TypePolicies`, the
   * kit's field-renderer registry) is a contract the table fills, not a key
   * type the table chose; the standard library's `Record` and `Map` are not.
   */
  const isForeignContract = typeNode => {
    if (!ts.isTypeReferenceNode(typeNode)) return false;
    let symbol = checker.getSymbolAtLocation(typeNode.typeName);
    if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
      symbol = checker.getAliasedSymbol(symbol);
    }
    const declarations = symbol?.declarations ?? [];
    const home = typeNode.getSourceFile();
    return (
      declarations.length > 0 &&
      declarations.every(declaration => {
        const file = declaration.getSourceFile();
        return file !== home && !program.isSourceFileDefaultLibrary(file);
      })
    );
  };

  /** The value type a closed initializer is held to under a `string` key, if any. */
  const stringKeyedContract = declaration => {
    const { initializer } = declaration;
    if (!initializer) return undefined;
    const value = unwrap(initializer);
    if (declaration.type) {
      if (!isClosedObject(value) && !isClosedMapConstruction(value)) {
        return undefined;
      }
      if (isForeignContract(declaration.type)) return undefined;
      const valueType = stringKeyedValue(
        checker.getTypeFromTypeNode(declaration.type),
      );
      return valueType && { valueType, satisfied: false };
    }
    if (
      ts.isSatisfiesExpression(initializer) &&
      isClosedObject(unwrap(initializer.expression)) &&
      !isForeignContract(initializer.type)
    ) {
      const valueType = stringKeyedValue(
        checker.getTypeFromTypeNode(initializer.type),
      );
      return valueType && { valueType, satisfied: true };
    }
    if (isClosedMapConstruction(value)) {
      const valueType = stringKeyedValue(
        checker.getTypeAtLocation(declaration.name),
      );
      return valueType && { valueType, satisfied: false };
    }
    return undefined;
  };

  const finiteKeyName = type => {
    const parts = (type.isUnion() ? type.types : [type]).filter(
      part => (part.flags & NULLISH) === 0,
    );
    if (
      parts.length === 0 ||
      parts.some(part => (part.flags & LITERAL_KEY) === 0)
    ) {
      return undefined;
    }
    const enums = new Set(
      parts.map(part => {
        const declaration = part.getSymbol()?.valueDeclaration;
        return declaration && ts.isEnumMember(declaration)
          ? declaration.parent.name.text
          : undefined;
      }),
    );
    const [onlyEnum] = [...enums];
    if (enums.size === 1 && onlyEnum) return onlyEnum;
    const printed = checker.typeToString(
      type,
      undefined,
      ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
        ts.TypeFormatFlags.NoTruncation,
    );
    return printed.length > MAX_SUGGESTION_LENGTH
      ? `${printed.slice(0, MAX_SUGGESTION_LENGTH)}…`
      : printed;
  };

  /**
   * How the declaring file uses a table: whether it mutates it, reads it by a
   * runtime key, exports it, and which finite key types those reads carry.
   */
  const usage = declaration => {
    const symbol = checker.getSymbolAtLocation(declaration.name);
    const name = declaration.name.getText();
    const result = {
      mutated: false,
      dynamicRead: false,
      exported: false,
      keyTypes: new Set(),
    };
    if (!symbol) return result;
    const readKey = key => {
      result.dynamicRead = true;
      const keyName = finiteKeyName(checker.getTypeAtLocation(key));
      if (keyName) result.keyTypes.add(keyName);
    };
    const visit = node => {
      if (
        ts.isIdentifier(node) &&
        node.text === name &&
        node !== declaration.name &&
        checker.getSymbolAtLocation(node) === symbol
      ) {
        const reference = outermost(node);
        const { parent } = reference;
        if (ts.isExportSpecifier(parent)) {
          result.exported = true;
        } else if (
          ts.isElementAccessExpression(parent) &&
          parent.expression === reference
        ) {
          if (isWriteTarget(parent)) result.mutated = true;
          else if (!isLiteralSyntax(parent.argumentExpression)) {
            readKey(parent.argumentExpression);
          }
        } else if (
          ts.isPropertyAccessExpression(parent) &&
          parent.expression === reference
        ) {
          const method = parent.name.text;
          const call = parent.parent;
          const isCall =
            ts.isCallExpression(call) && call.expression === parent;
          if (
            isWriteTarget(parent) ||
            (isCall && MUTATING_MAP_METHODS.has(method))
          ) {
            result.mutated = true;
          } else if (isCall && READING_MAP_METHODS.has(method)) {
            const [key] = call.arguments;
            if (key && !isLiteralSyntax(key)) readKey(key);
          }
        } else if (
          ts.isBinaryExpression(parent) &&
          parent.right === reference &&
          parent.operatorToken.kind === ts.SyntaxKind.InKeyword
        ) {
          readKey(parent.left);
        } else if (
          ts.isCallExpression(parent) &&
          parent.arguments[0] === reference
        ) {
          const helper = objectHelperName(parent);
          if (helper && MUTATING_OBJECT_CALLS.has(helper))
            result.mutated = true;
          const [, key] = parent.arguments;
          if (helper === 'hasOwn' && key) readKey(key);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(declaration.getSourceFile());
    const modifiers = ts.getCombinedModifierFlags(declaration);
    if ((modifiers & ts.ModifierFlags.Export) !== 0) result.exported = true;
    return result;
  };

  /** A `const` holding a closed literal table under a `string`-keyed type, or undefined. */
  const closedTable = declaration => {
    if (cache.has(declaration)) return cache.get(declaration);
    let table;
    if (
      ts.isVariableDeclaration(declaration) &&
      ts.isIdentifier(declaration.name) &&
      ts.isVariableDeclarationList(declaration.parent) &&
      (declaration.parent.flags & ts.NodeFlags.Const) !== 0 &&
      !EXEMPT_FILE.test(declaration.getSourceFile().fileName)
    ) {
      const contract = stringKeyedContract(declaration);
      if (contract && !isOpaque(contract.valueType)) {
        const used = usage(declaration);
        if (!used.mutated) {
          table = {
            name: declaration.name.text,
            satisfied: contract.satisfied,
            ...used,
          };
        }
      }
    }
    cache.set(declaration, table);
    return table;
  };

  return { closedTable, finiteKeyName, isLiteralSyntax };
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A closed lookup table is keyed by the real key type, never by string.',
      url: 'docs/rules/no-string-keyed-lookup.md',
    },
    schema: [],
    messages: {
      closedTable:
        '`{{name}}` lists every key it will ever hold, but is typed with a `string` key, so a missing or misspelled key compiles and every read may be `undefined`. Key it by the real key type ({{keyType}}), never `satisfies`, never a cast.',
      finiteKeyRead:
        '`{{name}}` is read with a key of type `{{keyType}}`, but is keyed by `string`, so a member `{{keyType}}` gains or loses still compiles against the table. Key `{{name}}` by `{{keyType}}` where it is declared, never `satisfies`, never a cast.',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program || EXEMPT_FILE.test(context.filename)) return {};
    const checker = services.program.getTypeChecker();
    const { closedTable, finiteKeyName, isLiteralSyntax } = createAnalysis(
      services.program,
    );
    const toTs = node => services.esTreeNodeToTSNodeMap.get(node);

    const tableBehind = expression => {
      const target = unwrap(expression);
      if (!ts.isIdentifier(target)) return undefined;
      let symbol = checker.getSymbolAtLocation(target);
      if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
        symbol = checker.getAliasedSymbol(symbol);
      }
      const declaration = symbol?.valueDeclaration;
      return declaration ? closedTable(declaration) : undefined;
    };

    const checkRead = (tableNode, keyNode, reportNode) => {
      const table = tableBehind(tableNode);
      if (!table) return;
      if (isLiteralSyntax(keyNode)) return;
      const keyType = finiteKeyName(checker.getTypeAtLocation(unwrap(keyNode)));
      if (!keyType) return;
      context.report({
        node: reportNode,
        messageId: 'finiteKeyRead',
        data: { name: table.name, keyType },
      });
    };

    return {
      VariableDeclarator(node) {
        const table = closedTable(toTs(node));
        if (!table) return;
        // `satisfies` keeps the literal keys, so a named preset read by
        // property is checked; it is a table once a finite key reads it.
        const isLookup = table.satisfied
          ? table.keyTypes.size > 0
          : table.dynamicRead || table.exported;
        if (!isLookup) return;
        const keyTypes = [...table.keyTypes];
        context.report({
          node: node.id,
          messageId: 'closedTable',
          data: {
            name: table.name,
            keyType:
              keyTypes.length > 0
                ? keyTypes.map(name => `\`${name}\``).join(' / ')
                : 'the enum or union its keys belong to',
          },
        });
      },
      MemberExpression(node) {
        if (!node.computed) return;
        const access = toTs(node);
        if (!ts.isElementAccessExpression(access) || isWriteTarget(access))
          return;
        checkRead(access.expression, access.argumentExpression, node);
      },
      CallExpression(node) {
        const call = toTs(node);
        if (
          !ts.isCallExpression(call) ||
          !ts.isPropertyAccessExpression(call.expression) ||
          !READING_MAP_METHODS.has(call.expression.name.text)
        ) {
          return;
        }
        const [key] = call.arguments;
        if (key) checkRead(call.expression.expression, key, node);
      },
    };
  },
};
