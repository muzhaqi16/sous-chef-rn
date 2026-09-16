const path = require('node:path');
const ts = require('typescript');
const { COPY_ATTRIBUTES } = require('../../i18n');
const { isDeveloperFacing } = require('../developerFacing');

const SCHEMA_TYPES = `${path.sep}src${path.sep}graphql${path.sep}generated${path.sep}schemaTypes.ts`;

const COPY_NAMES = new Set(COPY_ATTRIBUTES);
const SINK_SERVICES = /^(toastService|alertService)$/;
const TRANSLATE_FUNCTIONS = /^(t|tGlobal|translate)$/;
// Cutting an identifier apart to re-case it is display munging wherever it runs.
const RECASING_TRANSFORMS = new Set(['charAt', 'slice', 'substring', 'substr']);
const STRING_TRANSFORMS = new Set([
  ...RECASING_TRANSFORMS,
  'toLowerCase',
  'toUpperCase',
  'toLocaleLowerCase',
  'toLocaleUpperCase',
  'replace',
  'replaceAll',
  'split',
  'concat',
  'padStart',
  'padEnd',
]);
const NULLISH = ts.TypeFlags.Undefined | ts.TypeFlags.Null;
const COPY_VARIABLE =
  /^(label|text|title|subtitle|message|description|caption|hint|placeholder)$|[a-z0-9](Label|Text|Title|Subtitle|Message|Description|Caption|Hint|Placeholder|Display)$/;
const COMPARISONS = new Set(['===', '!==', '==', '!=']);
const DISPLAY_FUNCTION =
  /^format|(Label|Text|Title|Subtitle|Message|Description|Caption|Display)$/;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A schema enum value reaches the screen through a translation table, never raw or string-munged.',
      url: 'docs/rules/no-rendered-enum.md',
    },
    schema: [],
    messages: {
      rendered:
        'This is a value of the generated `{{enumName}}`: an API identifier, not copy, so it renders untranslated. Map it through a table keyed by `{{enumName}}` to a `TranslationKey` and render `t(table[value])`, or compose the key as a template literal `t(`prefix.${value}`)` the key type checks.',
      widened:
        'A value of the generated `{{enumName}}` is passed to a display formatter that takes `string`, so the enum is rendered by string munging no locale translates. Map it through a table keyed by `{{enumName}}` to a `TranslationKey` instead.',
      transformed:
        '`{{method}}` on a value of the generated `{{enumName}}` turns an API identifier into English-looking text that no locale translates. Map the value through a table keyed by `{{enumName}}` to a `TranslationKey` instead.',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program) return {};
    const checker = services.program.getTypeChecker();

    const typeOf = node =>
      checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node));

    const isSchemaEnumMember = type => {
      if ((type.flags & ts.TypeFlags.EnumLiteral) === 0) return undefined;
      const symbol = type.getSymbol();
      const declaration = symbol?.declarations?.[0];
      if (!declaration?.getSourceFile().fileName.endsWith(SCHEMA_TYPES)) {
        return undefined;
      }
      return declaration.parent.name.text;
    };

    /** The generated enum a value is typed as, nullish parts aside. */
    const schemaEnumOf = node => {
      const type = typeOf(node);
      const parts = (type.isUnion() ? type.types : [type]).filter(
        part => (part.flags & NULLISH) === 0,
      );
      if (parts.length === 0) return undefined;
      let enumName;
      for (const part of parts) {
        const name = isSchemaEnumMember(part);
        if (!name || (enumName && name !== enumName)) return undefined;
        enumName = name;
      }
      return enumName;
    };

    const reported = new Set();
    const report = (node, enumName) => {
      if (reported.has(node)) return;
      reported.add(node);
      context.report({ node, messageId: 'rendered', data: { enumName } });
    };

    /** Walks down to the values an expression hands on unchanged. */
    const checkValue = node => {
      switch (node.type) {
        case 'ChainExpression':
          return checkValue(node.expression);
        case 'TSNonNullExpression':
        case 'TSAsExpression':
          return checkValue(node.expression);
        case 'LogicalExpression':
          if (node.operator !== '&&') checkValue(node.left);
          return checkValue(node.right);
        case 'ConditionalExpression':
          checkValue(node.consequent);
          return checkValue(node.alternate);
        case 'TemplateLiteral':
          return node.expressions.forEach(checkValue);
        case 'BinaryExpression':
          if (node.operator !== '+') return undefined;
          checkValue(node.left);
          return checkValue(node.right);
        case 'ArrayExpression':
          return node.elements.forEach(e => e && checkValue(e));
        case 'Identifier':
        case 'MemberExpression':
        case 'CallExpression': {
          if (
            node.type === 'CallExpression' &&
            node.callee.type === 'Identifier' &&
            node.callee.name === 'String' &&
            node.arguments[0]
          ) {
            return checkValue(node.arguments[0]);
          }
          const enumName = schemaEnumOf(node);
          if (enumName) report(node, enumName);
          return undefined;
        }
        default:
          return undefined;
      }
    };

    const isTranslateCall = call => {
      const callee = call.callee;
      if (callee.type === 'Identifier') {
        return TRANSLATE_FUNCTIONS.test(callee.name);
      }
      return (
        callee.type === 'MemberExpression' &&
        !callee.computed &&
        callee.property.name === 't'
      );
    };

    const propertyName = property => {
      if (property.type !== 'Property' || property.computed) return undefined;
      if (property.key.type === 'Identifier') return property.key.name;
      return typeof property.key.value === 'string'
        ? property.key.value
        : undefined;
    };

    /** An enum handed to a display formatter that declares the parameter `string`. */
    const checkWidenedArguments = call => {
      const tsCall = services.esTreeNodeToTSNodeMap.get(call);
      const signature = checker.getResolvedSignature(tsCall);
      if (!signature) return;
      call.arguments.forEach((argument, index) => {
        const enumName = schemaEnumOf(argument);
        const parameter = signature.getParameters()[index];
        if (!enumName || !parameter) return;
        const declared = checker.getTypeOfSymbolAtLocation(parameter, tsCall);
        const parts = (declared.isUnion() ? declared.types : [declared]).filter(
          part => (part.flags & NULLISH) === 0,
        );
        if (parts.some(part => (part.flags & ts.TypeFlags.String) !== 0)) {
          context.report({
            node: argument,
            messageId: 'widened',
            data: { enumName },
          });
        }
      });
    };

    const enclosingFunctionName = node => {
      let fn = node;
      while (fn && !/Function/.test(fn.type)) fn = fn.parent;
      if (!fn) return undefined;
      if (fn.id) return fn.id.name;
      return fn.parent?.type === 'VariableDeclarator' &&
        fn.parent.id.type === 'Identifier'
        ? fn.parent.id.name
        : undefined;
    };

    /**
     * Whether a re-cased enum (`status.toLowerCase()`) is shown rather than
     * compared or sent on: it reaches JSX, a copy property, a `t` interpolation,
     * a toast, or the return of a display formatter.
     */
    const transformReachesCopy = (start, seen) => {
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
          case 'MemberExpression': {
            const call = parent.parent;
            if (
              parent.object !== current ||
              parent.computed ||
              !STRING_TRANSFORMS.has(parent.property.name) ||
              call?.type !== 'CallExpression' ||
              call.callee !== parent
            ) {
              return false;
            }
            current = call;
            continue;
          }
          case 'BinaryExpression':
            if (COMPARISONS.has(parent.operator) || parent.operator !== '+') {
              return false;
            }
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
              holder.type === 'JSXAttribute' && COPY_NAMES.has(holder.name.name)
            );
          }
          case 'Property': {
            if (parent.value !== current) return false;
            const name = propertyName(parent);
            const object = parent.parent;
            const call = object.parent;
            return (
              (!!name && COPY_NAMES.has(name)) ||
              (call?.type === 'CallExpression' &&
                isTranslateCall(call) &&
                call.arguments[0] !== object)
            );
          }
          case 'CallExpression': {
            const callee = parent.callee;
            return (
              parent.callee !== current &&
              callee.type === 'MemberExpression' &&
              callee.object.type === 'Identifier' &&
              SINK_SERVICES.test(callee.object.name)
            );
          }
          case 'ReturnStatement': {
            const name = enclosingFunctionName(parent);
            return !!name && DISPLAY_FUNCTION.test(name);
          }
          case 'ArrowFunctionExpression': {
            if (parent.body !== current) return false;
            const name = enclosingFunctionName(parent);
            return !!name && DISPLAY_FUNCTION.test(name);
          }
          case 'VariableDeclarator': {
            if (parent.init !== current || parent.id.type !== 'Identifier') {
              return false;
            }
            if (COPY_VARIABLE.test(parent.id.name)) return true;
            const variable = context.sourceCode
              .getDeclaredVariables(parent)
              .find(candidate => candidate.name === parent.id.name);
            if (!variable || seen.has(variable)) return false;
            seen.add(variable);
            return variable.references.some(
              reference =>
                !reference.init &&
                transformReachesCopy(reference.identifier, seen),
            );
          }
          default:
            return false;
        }
        current = parent;
      }
    };

    /** A composed string rendered later: checked where it is declared. */
    const checkComposed = node => {
      if (isDeveloperFacing(node)) return;
      const parent = node.parent;
      if (
        parent.type === 'CallExpression' &&
        isTranslateCall(parent) &&
        parent.arguments[0] === node
      ) {
        return;
      }
      if (
        parent.type === 'ReturnStatement' ||
        parent.type === 'ArrowFunctionExpression'
      ) {
        let fn = parent;
        while (fn && !/Function/.test(fn.type)) fn = fn.parent;
        const name =
          fn?.id?.name ??
          (fn?.parent?.type === 'VariableDeclarator'
            ? fn.parent.id.name
            : undefined);
        if (name && DISPLAY_FUNCTION.test(name)) checkValue(node);
      }
      if (
        parent.type === 'VariableDeclarator' &&
        parent.id.type === 'Identifier' &&
        COPY_VARIABLE.test(parent.id.name)
      ) {
        checkValue(node);
      }
    };

    return {
      JSXExpressionContainer(node) {
        const holder = node.parent;
        if (holder.type === 'JSXElement' || holder.type === 'JSXFragment') {
          checkValue(node.expression);
        } else if (
          holder.type === 'JSXAttribute' &&
          COPY_NAMES.has(holder.name.name)
        ) {
          checkValue(node.expression);
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          SINK_SERVICES.test(callee.object.name)
        ) {
          node.arguments.forEach(checkValue);
          return;
        }
        if (isTranslateCall(node)) {
          for (const options of node.arguments.slice(1)) {
            if (options.type !== 'ObjectExpression') continue;
            for (const property of options.properties) {
              if (property.type === 'Property') checkValue(property.value);
            }
          }
          return;
        }
        const calleeName =
          callee.type === 'Identifier'
            ? callee.name
            : callee.type === 'MemberExpression' && !callee.computed
            ? callee.property.name
            : undefined;
        if (calleeName && DISPLAY_FUNCTION.test(calleeName)) {
          checkWidenedArguments(node);
        }
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          STRING_TRANSFORMS.has(callee.property.name)
        ) {
          const enumName = schemaEnumOf(callee.object);
          if (!enumName || isDeveloperFacing(node)) return;
          if (
            RECASING_TRANSFORMS.has(callee.property.name) ||
            transformReachesCopy(node, new Set())
          ) {
            context.report({
              node,
              messageId: 'transformed',
              data: { enumName, method: callee.property.name },
            });
          }
        }
      },
      Property(node) {
        if (node.parent.type !== 'ObjectExpression') return;
        const name = propertyName(node);
        if (name && COPY_NAMES.has(name) && !isDeveloperFacing(node)) {
          checkValue(node.value);
        }
      },
      TemplateLiteral(node) {
        if (node.parent.type === 'TaggedTemplateExpression') return;
        if (node.expressions.length > 0) checkComposed(node);
      },
      'BinaryExpression[operator="+"]'(node) {
        if (node.parent.type === 'BinaryExpression') return;
        checkComposed(node);
      },
    };
  },
};
