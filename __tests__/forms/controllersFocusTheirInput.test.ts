import { readFileSync } from 'fs';
import { basename } from 'path';
import { execSync } from 'child_process';
import * as ts from 'typescript';

/**
 * A failed submit focuses the first field in error, and the keyboard-aware
 * scroller brings it into view, only through the ref react-hook-form holds for
 * it. A `Controller` whose input never receives `field.ref` leaves the person
 * looking at a message they may not be able to see.
 */

const sources = (pattern: string): string[] =>
  execSync(`git grep -l "${pattern}" -- 'src/**/*.tsx' 'src/**/*.ts'`, {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(file => file && !file.includes('__tests__'));

const componentsDeclaring = (pattern: string): Set<string> =>
  new Set(sources(pattern).map(file => basename(file).replace(/\.tsx?$/, '')));

/** Inputs that take a focusable `ref`, derived from their props. */
const TEXT_INPUTS = new Set([
  'ThemedTextInput',
  // Its props are BaseInput's.
  'EmailInput',
  ...componentsDeclaring('ref?: React.Ref<FocusableInputRef>'),
  ...componentsDeclaring('ref?: React.Ref<ThemedTextInputRef>'),
]);

/** Autocompletes, which take their input's ref as `chaining.inputRef`. */
const AUTOCOMPLETES = componentsDeclaring('chaining?: FieldChaining');

type Element = ts.JsxElement | ts.JsxSelfClosingElement;

const openingOf = (node: Element) =>
  ts.isJsxElement(node) ? node.openingElement : node;

const tagOf = (node: ts.Node): string | null =>
  ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)
    ? openingOf(node).tagName.getText()
    : null;

const attribute = (node: Element, name: string) =>
  openingOf(node).attributes.properties.find(
    property => ts.isJsxAttribute(property) && property.name.getText() === name,
  );

/** A `modal` autocomplete is a button, with no input to focus. */
const isModal = (node: Element) =>
  attribute(node, 'variant')?.getText() === 'variant="modal"';

/** Each input a `Controller` renders and hands no ref, as `file:line Tag`. */
function unfocusedInputs(file: string, text: string): string[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const inRender = (node: ts.Node) => {
    // A nested Controller is checked as its own.
    if (tagOf(node) === 'Controller') return;
    const tag = tagOf(node);
    if (tag && (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node))) {
      const handed = TEXT_INPUTS.has(tag)
        ? attribute(node, 'ref')
        : AUTOCOMPLETES.has(tag) && !isModal(node)
        ? attribute(node, 'chaining')?.getText().includes('inputRef')
        : true;
      if (!handed) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        found.push(`${file}:${line + 1} ${tag}`);
      }
    }
    ts.forEachChild(node, inRender);
  };
  const visit = (node: ts.Node) => {
    if (
      tagOf(node) === 'Controller' &&
      (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node))
    ) {
      const render = attribute(node, 'render');
      const fn =
        render && ts.isJsxAttribute(render) && render.initializer
          ? ts.isJsxExpression(render.initializer)
            ? render.initializer.expression
            : undefined
          : undefined;
      if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
        ts.forEachChild(fn.body, inRender);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('a Controller hands its input the field ref', () => {
  it('derives the inputs from their props', () => {
    expect([...TEXT_INPUTS]).toEqual(
      expect.arrayContaining(['FormInput', 'FractionInput', 'FormTextArea']),
    );
    expect([...AUTOCOMPLETES]).toEqual(
      expect.arrayContaining(['UnitAutocompleteField']),
    );
  });

  it('catches an input with no ref, nested or not', () => {
    const planted = `
      <Controller control={control} name="size" render={({ field: size }) => (
        <Controller control={control} name="unit" render={({ field }) => (
          <View>
            <FormInput value={size.value} />
            <UnitAutocompleteField variant="inline" value={field.value} />
            <UnitAutocompleteField variant="modal" value={field.value} />
          </View>
        )} />
      )} />`;

    expect(unfocusedInputs('planted.tsx', planted)).toEqual([
      'planted.tsx:5 FormInput',
      'planted.tsx:6 UnitAutocompleteField',
    ]);
  });

  it('passes an input given its ref', () => {
    const planted = `
      <Controller control={control} name="name" render={({ field }) => (
        <FormInput ref={field.ref} value={field.value} />
      )} />`;

    expect(unfocusedInputs('planted.tsx', planted)).toEqual([]);
  });

  it('holds in every form', () => {
    const forms = sources('<Controller');
    expect(forms.length).toBeGreaterThan(20);

    const unfocused = forms.flatMap(file =>
      unfocusedInputs(file, readFileSync(file, 'utf8')),
    );

    expect(unfocused).toEqual([]);
  });
});
