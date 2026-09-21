/**
 * The `no-restricted-syntax` entries, linted through the config that ships.
 * A selector is a string until something runs it: this pins each entry to the
 * code it is meant to catch, and the id coverage check keeps a new entry from
 * arriving untested.
 */
import { Linter } from 'eslint';
import * as typescriptParser from '@typescript-eslint/parser';

const {
  PRODUCTION_SYNTAX,
  TEST_SYNTAX,
  restrictedSyntax,
  restrictedSyntaxForTests,
} = require('../../eslint/restrictedSyntax.js') as {
  PRODUCTION_SYNTAX: Array<{ id: string; selector: string; message: string }>;
  TEST_SYNTAX: Array<{ id: string; selector: string; message: string }>;
  restrictedSyntax: (o?: { allow?: string[] }) => unknown[];
  restrictedSyntaxForTests: () => unknown[];
};

const linter = new Linter();

const lint = (code: string, entries: unknown[]) =>
  linter.verify(
    code,
    [
      {
        files: ['**/*.tsx'],
        languageOptions: {
          parser: typescriptParser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        rules: { 'no-restricted-syntax': entries as never },
      },
    ],
    'case.tsx',
  );

type Fixture = { id: string; invalid: string[]; valid: string[] };

const PRODUCTION_FIXTURES: Fixture[] = [
  {
    id: 'parseFloat',
    invalid: ['parseFloat("1");', 'Number.parseFloat("1");'],
    valid: ['parseDecimalInput("4,99");', 'Number.parseInt("4", 10);'],
  },
  {
    id: 'inlineImportType',
    invalid: ['type T = import("./other").Thing;'],
    valid: ['import type { Thing } from "./other"; type T = Thing;'],
  },
  {
    id: 'imperativeSheet',
    invalid: ['sheetRef.present();', 'modalRef.current.dismiss();'],
    valid: ['Keyboard.dismiss();', 'sheetRef.present(options);'],
  },
  {
    id: 'maxFontSizeMultiplier',
    invalid: ['const a = <Text maxFontSizeMultiplier={1.2} />;'],
    valid: ['const a = <Text role="body" />;'],
  },
  {
    id: 'allowFontScaling',
    invalid: ['const b = <Text allowFontScaling={false} />;'],
    valid: ['const b = <Text allowFontScaling />;'],
  },
  {
    id: 'handRolledSearch',
    invalid: ['items.filter(i => i.name.toLowerCase().includes(term));'],
    valid: [
      'filterByTerm(items, term, i => i.name);',
      'items.filter(i => i.done);',
    ],
  },
  {
    id: 'borderWidthLiteral',
    invalid: [
      'const s = { borderWidth: 1 };',
      'const s = { borderTopWidth: 0.5 };',
    ],
    valid: ['const s = { borderWidth: theme.borderWidth.hairline };'],
  },
  {
    id: 'toastLiteral',
    invalid: ['toastService.show("Hello world");'],
    valid: ['toastService.show(t("pantry.saved"));', 'toastService.show("✕");'],
  },
  {
    id: 'toastServerMessage',
    invalid: ['alertService.alert(error.message);'],
    valid: ['alertService.alert(failure.body);'],
  },
  {
    id: 'toastTemplateLiteral',
    invalid: ['toastService.show(`Hi ${name}`);'],
    valid: ['toastService.show(t("greeting", { name }));'],
  },
  {
    id: 'scheduleOnRNInlineCallback',
    invalid: ['scheduleOnRN(() => {});', 'scheduleOnRN(function named() {});'],
    valid: ['scheduleOnRN(handleDismiss);', 'scheduleOnRN(handleSelect, id);'],
  },
  {
    id: 'scheduleOnRNTooManyArguments',
    invalid: ['scheduleOnRN(fn, 1, 2);'],
    valid: ['scheduleOnRN(fn, 1);'],
  },
  {
    id: 'rnTouchableInSwipeable',
    invalid: [
      'const a = <SwipeableItem><AppPressable onPress={f} accessibilityLabel={l} /></SwipeableItem>;',
    ],
    valid: [
      'const a = <SwipeableItem><Pressable onPress={f} accessibilityLabel={l} /></SwipeableItem>;',
    ],
  },
  {
    id: 'legacyShadowProp',
    invalid: [
      'const s = { shadowColor: "black" };',
      'const s = { shadowRadius: 3 };',
    ],
    valid: ['const s = { ...theme.shadows.md };'],
  },
  {
    id: 'sharedValueAssignment',
    invalid: ['progress.value = 1;'],
    valid: ['progress.set(1);', 'const v = progress.value;'],
  },
  {
    id: 'asConst',
    invalid: ['const steps = [1, 2] as const;'],
    valid: ['const steps = { a: 1 } satisfies Record<string, number>;'],
  },
  {
    id: 'unusedUseUnistyles',
    invalid: ['useUnistyles();'],
    valid: ['const { rt } = useUnistyles();'],
  },
  {
    id: 'combinedUnistyles',
    invalid: ['const a = <View style={[styles.a, styles.b]} />;'],
    valid: ['const a = <View style={[styles.row, style]} />;'],
  },
  {
    id: 'modalPropsOverride',
    invalid: [
      'const a = <BottomSheetModal {...modalProps} onChange={f} />;',
      'const a = <BottomSheetModal {...modalProps} animatedIndex={g} />;',
    ],
    valid: [
      'const a = <BottomSheetModal {...modalProps} snapPoints={points} />;',
    ],
  },
  {
    id: 'optimisticResponseCast',
    invalid: [
      'useMutation(doc, { optimisticResponse: { item: { __typename: "X", id } as T } });',
    ],
    valid: ['useMutation(doc, { optimisticResponse: build(cache) });'],
  },
  {
    id: 'missingPressableLabel',
    invalid: [
      'const a = <Pressable onPress={f}><Icon /></Pressable>;',
      'const b = <PressableScale onPress={f}><Icon /></PressableScale>;',
    ],
    valid: [
      'const a = <Pressable onPress={f} accessibilityLabel={t("close")}><Icon /></Pressable>;',
      'const b = <Pressable onPress={f}><Text>{label}</Text></Pressable>;',
    ],
  },
  {
    id: 'callerFallbackAfterResolver',
    invalid: [
      "const m = localizedErrorMessage(err) || t('errors.generic');",
      "const m = localizedErrorMessage(err) ?? t('errors.generic');",
    ],
    valid: [
      "const m = localizedErrorMessage(err, t('errors.generic'));",
      "const m = other(err) || t('errors.generic');",
    ],
  },
  {
    id: 'asUnknown',
    invalid: ['const a = value as unknown as T;'],
    valid: ['const f = value as Profile;'],
  },
  {
    id: 'asNever',
    invalid: ['extractNodes(home.pantriesConnection as never);'],
    valid: ['extractNodes(home.pantriesConnection);'],
  },
  {
    id: 'asRecord',
    invalid: ['const a = value as Record<string, unknown>;'],
    valid: ['const b: Record<string, number> = {};'],
  },
  {
    id: 'asKeyof',
    invalid: [
      'const n = counts[`rating${n}Count` as keyof typeof counts];',
      'setValue(field as keyof FormValues, value);',
      'const keys = Object.keys(defaults) as (keyof FormData)[];',
      'const keys = Object.keys(defaults) as readonly (keyof FormData)[];',
      'const keys = Object.keys(defaults) as Array<keyof FormData>;',
      'const k = key as Extract<keyof FormData, string>;',
    ],
    valid: [
      'type K = keyof typeof table;',
      'const d = value as T[keyof T];',
      'if (isOwnKey(table, key)) use(table[key]);',
    ],
  },
  {
    id: 'asTranslationKey',
    invalid: ['const key = `errors.field.${field}` as TranslationKey;'],
    valid: ['const key: TranslationKey = "errors.field.name";'],
  },
];

const TEST_FIXTURES: Fixture[] = [
  {
    id: 'apolloReactMock',
    invalid: ['jest.mock("@apollo/client/react");'],
    valid: ['jest.mock("#/services/haptic");'],
  },
  {
    id: 'typenameAsConst',
    invalid: ["const a = { __typename: 'Home' as const, id: 'h1' };"],
    valid: [
      "const a: HomeNode = { __typename: 'Home', id: 'h1' };",
      'const steps = [1, 2] as const;',
    ],
  },
  {
    id: 'bareInMemoryCache',
    invalid: [
      'import { renderWithApollo } from "#/test-utils/apolloMockProvider"; const cache = new InMemoryCache();',
    ],
    valid: [
      'import { makeCache } from "#/test-utils/apolloMockProvider"; const cache = makeCache();',
      'const cache = new InMemoryCache();',
    ],
  },
];

const suites = [
  {
    label: 'production',
    list: PRODUCTION_SYNTAX,
    fixtures: PRODUCTION_FIXTURES,
    entries: restrictedSyntax(),
  },
  {
    label: 'test-only',
    list: TEST_SYNTAX,
    fixtures: TEST_FIXTURES,
    entries: restrictedSyntaxForTests(),
  },
];

describe.each(suites)('$label no-restricted-syntax entries', suite => {
  const messageOf = (id: string) =>
    suite.list.find(entry => entry.id === id)?.message;

  it('gives every entry a fixture', () => {
    const covered = new Set(suite.fixtures.map(f => f.id));
    expect(suite.list.map(e => e.id).filter(id => !covered.has(id))).toEqual(
      [],
    );
    expect(suite.fixtures.map(f => f.id).filter(id => !messageOf(id))).toEqual(
      [],
    );
  });

  it.each(suite.fixtures)('$id reports the code it names', fixture => {
    const message = messageOf(fixture.id);

    for (const code of fixture.invalid) {
      const reported = lint(code, suite.entries).map(m => m.message);
      expect({ code, reported }).toEqual({ code, reported: [message] });
    }

    for (const code of fixture.valid) {
      expect({ code, reported: lint(code, suite.entries) }).toEqual({
        code,
        reported: [],
      });
    }
  });
});

describe('restrictedSyntax()', () => {
  it('drops only what an override names, and never leaks the config-only id', () => {
    const kept = restrictedSyntax({ allow: ['parseFloat'] });
    expect(lint('parseFloat("1");', kept)).toEqual([]);
    expect(lint('useUnistyles();', kept)).toHaveLength(1);
    expect(kept.slice(1).every(entry => !('id' in (entry as object)))).toBe(
      true,
    );
  });
});
