const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-unsafe-cast',
  description:
    'No as any, as any[], as unknown, as never, as Record<…>, keyof or translation-key casts.',
  checks: [
    {
      messageId: 'asAny',
      selector: 'TSAsExpression[typeAnnotation.type="TSAnyKeyword"]',
      message:
        'Do not cast with `as any` — it hides real type errors. Let inference carry the type: delete the hand-written type that blocks it, or narrow with a type guard. Where inference is impossible, declare the type where the value is declared.',
    },
    {
      messageId: 'asAnyArray',
      selector:
        'TSAsExpression[typeAnnotation.type="TSArrayType"][typeAnnotation.elementType.type="TSAnyKeyword"]',
      message:
        'Do not cast with `as any[]` — it hides real type errors. Let the element type be inferred from its source, or declare it where the array is declared.',
    },
    {
      messageId: 'asUnknown',
      selector: 'TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]',
      message:
        'Do not use `as unknown` (typically the `x as unknown as T` double-cast) — it fully defeats type checking. Fix the data flow, or widen the type where it is declared.',
    },
    {
      messageId: 'asNever',
      selector: 'TSAsExpression[typeAnnotation.type="TSNeverKeyword"]',
      message:
        'Do not cast with `as never` — `never` is assignable to every type, so this switches type checking off exactly like `as any`. Delete the hand-written or `unknown` type that forced it so the real type is inferred, or widen the parameter where it is declared.',
    },
    {
      messageId: 'asRecord',
      selector:
        'TSAsExpression[typeAnnotation.type="TSTypeReference"][typeAnnotation.typeName.name="Record"]',
      message:
        'Do not cast to `Record<…>` — it asserts a shape instead of proving it. Narrow with a type guard (`typeof x === "object" && x !== null`), infer from the source, or declare the type where the value is declared.',
    },
    {
      messageId: 'asKeyof',
      selector: [
        'TSAsExpression > TSTypeOperator.typeAnnotation[operator="keyof"]',
        'TSAsExpression > TSArrayType.typeAnnotation > TSTypeOperator[operator="keyof"]',
        'TSAsExpression > TSTypeOperator.typeAnnotation[operator="readonly"] > TSArrayType > TSTypeOperator[operator="keyof"]',
        'TSAsExpression > TSTypeReference.typeAnnotation > TSTypeParameterInstantiation > TSTypeOperator[operator="keyof"]',
      ].join(', '),
      message:
        'Do not cast a string to a key with `as keyof …` — it indexes with a key the object may not have, and the read comes back `undefined` under a type that says it cannot. Narrow the key first (`isOwnKey(obj, key)` from `#utils/isOwnKey`, or `key in obj`), iterate a typed list of the keys, or type the key where it is declared.',
    },
    {
      messageId: 'asTranslationKey',
      selector:
        'TSAsExpression[typeAnnotation.type="TSTypeReference"][typeAnnotation.typeName.name=/^(TranslationKey|ParseKeys)$/]',
      message:
        'Do not cast a string to a translation key — it compiles a key the copy may not declare, which renders as a raw dot-path. Type the field that stores the key `TranslationKey` where it is declared, or check a key built from runtime data with `isTranslationKey` from `#/i18n`.',
    },
  ],
});
