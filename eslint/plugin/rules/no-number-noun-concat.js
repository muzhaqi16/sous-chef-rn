const ts = require('typescript');
const {
  COPY_ATTRIBUTES,
  SINK_SERVICES,
  TRANSLATE_FUNCTIONS,
  COPY_VARIABLE,
  DISPLAY_FUNCTION,
} = require('../../i18n');
const { isDeveloperFacing } = require('../developerFacing');

const COPY_NAMES = new Set(COPY_ATTRIBUTES);

const LEADING_WORD = /^\s*(\p{L}+)/u;
const TRAILING_WORD = /(\p{L}+)\s*$/u;

// Beside a number these are not nouns: "1 1/4 cup", "250g", "(5s)", "3 Mar", "12 EUR".
const UNIT_NAME =
  /^(unit|units|symbol|unitSymbol|abbreviation)$|[a-z0-9](Unit|Symbol|Abbreviation)$/;
const UNIT_HOLDER = /^unit$|Unit$/;
const UNIT_CALL = /Unit|Symbol/;
const DATE_NAME = /date|time|month|weekday/i;
const CURRENCY_NAME =
  /^(money|formatMoney|formatCurrency|formatPrice)$|currency/i;
const UNIT_SYMBOLS = new Set([
  'g',
  'kg',
  'mg',
  'mcg',
  'μg',
  'µg',
  'l',
  'L',
  'ml',
  'mL',
  'dl',
  'dL',
  'cl',
  'cL',
  'oz',
  'lb',
  'lbs',
  'kcal',
  'cal',
  'kJ',
  'ms',
  'μs',
  'µs',
  's',
  'min',
  'h',
  'd',
  'px',
  'B',
  'KB',
  'kB',
  'MB',
  'GB',
  'x',
]);

// A call whose result is the number it was given, only written out.
const NUMBER_FORMATTERS = new Set([
  'formatQuantityForDisplay',
  'formatQuantityForInput',
  'formatQuantityAsFraction',
  'formatQuantity',
  'formatNumberForInput',
  'formatNumber',
  'formatDecimal',
  'String',
]);
const NUMBER_METHODS = new Set([
  'toFixed',
  'toPrecision',
  'toLocaleString',
  'toString',
]);

const IGNORED_PARTS =
  ts.TypeFlags.Null |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Void |
  ts.TypeFlags.BooleanLiteral;

const unwrap = node =>
  node.type === 'ChainExpression' ||
  node.type === 'TSNonNullExpression' ||
  node.type === 'TSAsExpression'
    ? unwrap(node.expression)
    : node;

const nameOf = node => {
  const target = unwrap(node);
  switch (target.type) {
    case 'Identifier':
      return target.name;
    case 'MemberExpression':
      return !target.computed && target.property.type === 'Identifier'
        ? target.property.name
        : undefined;
    case 'CallExpression':
      return nameOf(target.callee);
    case 'LogicalExpression':
      return target.operator === '&&'
        ? nameOf(target.right)
        : nameOf(target.left);
    default:
      return undefined;
  }
};

const isTranslateCall = call =>
  (call.callee.type === 'Identifier' &&
    TRANSLATE_FUNCTIONS.test(call.callee.name)) ||
  (call.callee.type === 'MemberExpression' &&
    !call.callee.computed &&
    call.callee.property.type === 'Identifier' &&
    call.callee.property.name === 't');

const isSinkServiceCall = call =>
  call.callee.type === 'MemberExpression' &&
  call.callee.object.type === 'Identifier' &&
  SINK_SERVICES.test(call.callee.object.name);

const functionName = fn => {
  if (fn.id) return fn.id.name;
  return fn.parent?.type === 'VariableDeclarator' &&
    fn.parent.id.type === 'Identifier'
    ? fn.parent.id.name
    : undefined;
};

const enclosingFunction = node => {
  let current = node.parent;
  while (current && !/Function/.test(current.type)) current = current.parent;
  return current;
};

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A count and its noun are one translated sentence, never a number joined to a string.',
      url: 'docs/rules/no-number-noun-concat.md',
    },
    schema: [],
    messages: {
      concatenated:
        '`{{number}}` is joined to `{{noun}}`, so the plural form, the word order and the number format are fixed in code: at one it reads "1 {{noun}}", and no locale can reorder it. Use one key holding a whole sentence per plural form: `t(\'key\', { count })`.',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program) return {};
    const checker = services.program.getTypeChecker();
    const sourceCode = context.sourceCode;

    const typeParts = node => {
      const type = checker.getTypeAtLocation(
        services.esTreeNodeToTSNodeMap.get(node),
      );
      return (type.isUnion() ? type.types : [type]).filter(
        part =>
          (part.flags & IGNORED_PARTS) === 0 &&
          !(part.isStringLiteral() && part.value === ''),
      );
    };

    const isStringTyped = node => {
      const parts = typeParts(node);
      return (
        parts.length > 0 &&
        parts.every(part => (part.flags & ts.TypeFlags.StringLike) !== 0)
      );
    };

    const isNumberTyped = node => {
      const parts = typeParts(node);
      return (
        parts.length > 0 &&
        parts.every(
          part =>
            (part.flags &
              (ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike)) !==
            0,
        )
      );
    };

    const isNumberLike = node => {
      const target = unwrap(node);
      if (target.type === 'CallExpression') {
        const callee = unwrap(target.callee);
        const [first] = target.arguments;
        if (
          callee.type === 'Identifier' &&
          NUMBER_FORMATTERS.has(callee.name)
        ) {
          return (
            !!first && first.type !== 'SpreadElement' && isNumberTyped(first)
          );
        }
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          NUMBER_METHODS.has(callee.property.name)
        ) {
          return isNumberTyped(callee.object);
        }
      }
      return isNumberTyped(target);
    };

    /** Literal text whose word touching the number is a word, not a unit symbol or punctuation. */
    const textIsNoun = (text, edge) => {
      const match = (edge === 'start' ? LEADING_WORD : TRAILING_WORD).exec(
        text,
      );
      return !!match?.[1] && !UNIT_SYMBOLS.has(match[1]);
    };

    const isUnitReference = node => {
      const target = unwrap(node);
      if (target.type === 'Identifier') return UNIT_NAME.test(target.name);
      if (target.type === 'CallExpression') {
        const callee = nameOf(target.callee);
        return (
          (!!callee && UNIT_CALL.test(callee)) ||
          (target.arguments.length > 0 &&
            target.arguments.every(argument => isUnitReference(argument)))
        );
      }
      if (target.type !== 'MemberExpression') return false;
      const property = nameOf(target);
      const holder = nameOf(target.object);
      return (
        (!!property && UNIT_NAME.test(property)) ||
        (!!holder && UNIT_HOLDER.test(holder))
      );
    };

    /**
     * A string operand that reads as a word at the `edge` touching the number,
     * not a unit, date, currency or separator.
     */
    const isNounString = (node, edge) => {
      const target = unwrap(node);
      switch (target.type) {
        case 'ConditionalExpression':
          return (
            isNounString(target.consequent, edge) ||
            isNounString(target.alternate, edge)
          );
        case 'LogicalExpression':
          return (
            (target.operator !== '&&' && isNounString(target.left, edge)) ||
            isNounString(target.right, edge)
          );
        case 'TemplateLiteral': {
          const quasi =
            edge === 'start'
              ? target.quasis[0]
              : target.quasis[target.quasis.length - 1];
          const text = quasi?.value.cooked ?? '';
          if (text.trim() !== '') return textIsNoun(text, edge);
          const expression =
            edge === 'start'
              ? target.expressions[0]
              : target.expressions[target.expressions.length - 1];
          return !!expression && isNounString(expression, edge);
        }
        case 'Literal':
          return (
            typeof target.value === 'string' && textIsNoun(target.value, edge)
          );
        default:
          break;
      }
      if (!isStringTyped(target)) return false;
      const parts = typeParts(target);
      if (parts.every(part => part.isStringLiteral())) {
        return parts.some(
          part => part.isStringLiteral() && textIsNoun(part.value, edge),
        );
      }
      const name = nameOf(target);
      return !(
        isUnitReference(target) ||
        (name && (DATE_NAME.test(name) || CURRENCY_NAME.test(name)))
      );
    };

    const report = (numberNode, noun) =>
      context.report({
        node: numberNode,
        messageId: 'concatenated',
        data: {
          number: sourceCode.getText(numberNode),
          noun:
            typeof noun === 'string' ? noun.trim() : sourceCode.getText(noun),
        },
      });

    const textSegment = value => ({ kind: 'text', text: value });
    const exprSegment = node => {
      if (node.type === 'Literal' && typeof node.value === 'string') {
        return textSegment(node.value);
      }
      if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
        return textSegment(node.quasis[0]?.value.cooked ?? '');
      }
      return { kind: 'expr', node };
    };

    /** Reports each number sitting beside a noun, through whitespace only. */
    const scan = rawSegments => {
      const segments = [];
      for (const segment of rawSegments) {
        const last = segments[segments.length - 1];
        if (segment.kind === 'text' && last?.kind === 'text') {
          last.text += segment.text;
        } else {
          segments.push({ ...segment });
        }
      }

      /** The noun after a number: literal text, or a string through whitespace. */
      const nounAfter = index => {
        const next = segments[index + 1];
        if (next?.kind === 'expr') {
          return isNounString(next.node, 'start') ? next.node : undefined;
        }
        if (next?.kind !== 'text') return undefined;
        if (next.text.trim() !== '') {
          return textIsNoun(next.text, 'start') ? next.text : undefined;
        }
        const beyond = segments[index + 2];
        return beyond?.kind === 'expr' && isNounString(beyond.node, 'start')
          ? beyond.node
          : undefined;
      };

      // Before a number only literal words count: a translated prefix
      // ("New quantity: ") carries its own punctuation, which types cannot see.
      const literalBefore = index => {
        const previous = segments[index - 1];
        return previous?.kind === 'text' && textIsNoun(previous.text, 'end')
          ? previous.text
          : undefined;
      };

      segments.forEach((segment, index) => {
        if (segment.kind !== 'expr' || !isNumberLike(segment.node)) return;
        const noun = nounAfter(index) ?? literalBefore(index);
        if (noun !== undefined) report(segment.node, noun);
      });
    };

    const flattenPlus = node =>
      node.type === 'BinaryExpression' &&
      node.operator === '+' &&
      isStringTyped(node)
        ? [...flattenPlus(node.left), ...flattenPlus(node.right)]
        : [node];

    /** Whether a composed string is shown: JSX, a copy prop, a `t` value, a toast, or a copy-named holder. */
    const reachesCopy = (start, seen) => {
      let current = start;
      for (;;) {
        const parent = current.parent;
        if (!parent) return false;
        switch (parent.type) {
          case 'ChainExpression':
          case 'TSNonNullExpression':
          case 'TSAsExpression':
          case 'TemplateLiteral':
            break;
          case 'BinaryExpression':
            if (parent.operator !== '+') return false;
            break;
          case 'LogicalExpression':
            if (parent.operator === '&&' && parent.left === current) {
              return false;
            }
            break;
          case 'ConditionalExpression':
            if (parent.test === current) return false;
            break;
          case 'JSXExpressionContainer': {
            const holder = parent.parent;
            if (holder.type === 'JSXElement' || holder.type === 'JSXFragment') {
              return true;
            }
            return (
              holder.type === 'JSXAttribute' &&
              holder.name.type === 'JSXIdentifier' &&
              COPY_NAMES.has(holder.name.name)
            );
          }
          case 'Property': {
            if (parent.value !== current) return false;
            const object = parent.parent;
            const call = object.parent;
            if (call?.type === 'CallExpression' && call.callee !== object) {
              if (isTranslateCall(call)) return call.arguments[0] !== object;
              if (isSinkServiceCall(call)) return true;
            }
            return (
              !parent.computed &&
              parent.key.type === 'Identifier' &&
              COPY_NAMES.has(parent.key.name)
            );
          }
          case 'CallExpression':
            return parent.callee !== current && isSinkServiceCall(parent);
          case 'ReturnStatement': {
            const fn = enclosingFunction(parent);
            const name = fn && functionName(fn);
            return !!name && DISPLAY_FUNCTION.test(name);
          }
          case 'ArrowFunctionExpression': {
            if (parent.body !== current) return false;
            const name = functionName(parent);
            return !!name && DISPLAY_FUNCTION.test(name);
          }
          case 'VariableDeclarator': {
            if (parent.init !== current || parent.id.type !== 'Identifier') {
              return false;
            }
            if (COPY_VARIABLE.test(parent.id.name)) return true;
            const variable = sourceCode
              .getDeclaredVariables(parent)
              .find(candidate => candidate.name === parent.id.name);
            if (!variable || seen.has(variable)) return false;
            seen.add(variable);
            return variable.references.some(
              reference =>
                !reference.init && reachesCopy(reference.identifier, seen),
            );
          }
          default:
            return false;
        }
        current = parent;
      }
    };

    const isShownComposition = node =>
      !isDeveloperFacing(node) && reachesCopy(node, new Set());

    const scanChildren = node =>
      scan(
        node.children.flatMap(child => {
          if (child.type === 'JSXText') return [textSegment(child.value)];
          if (child.type !== 'JSXExpressionContainer')
            return [{ kind: 'break' }];
          if (child.expression.type === 'JSXEmptyExpression') return [];
          return [exprSegment(child.expression)];
        }),
      );

    return {
      JSXElement: scanChildren,
      JSXFragment: scanChildren,
      TemplateLiteral(node) {
        if (node.parent.type === 'TaggedTemplateExpression') return;
        if (node.expressions.length === 0 || !isShownComposition(node)) return;
        const segments = [];
        node.quasis.forEach((quasi, index) => {
          segments.push(textSegment(quasi.value.cooked ?? ''));
          const expression = node.expressions[index];
          if (expression) segments.push({ kind: 'expr', node: expression });
        });
        scan(segments);
      },
      'BinaryExpression[operator="+"]'(node) {
        if (
          node.parent.type === 'BinaryExpression' &&
          node.parent.operator === '+'
        ) {
          return;
        }
        if (!isStringTyped(node) || !isShownComposition(node)) return;
        scan(flattenPlus(node).map(exprSegment));
      },
    };
  },
};
