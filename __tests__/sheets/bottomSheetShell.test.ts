import * as ts from 'typescript';
import { parseSource, productionSources } from '#/test-utils/sourceAst';
/**
 * Every sheet renders through the shell.
 *
 * A `BottomSheetModal` rendered by hand is a sheet that has to re-derive what
 * the shell already settles: the backdrop claim, the snap points, the keyboard
 * host, and the header. Each of those has a documented failure the repo has
 * already paid for — a stranded backdrop that eats taps, a sheet blind to the
 * keyboard, a list that cannot scroll because it sits in a `BottomSheetView`.
 *
 * A sheet the shell does not fit grows the shell an option (`modalOptions`,
 * `bottomInset`) rather than rendering its own modal.
 *
 * A type reference (`RefObject<BottomSheetModal>`, `BottomSheetModalProps`) is
 * not a render — the boundary assertions on either side are what keep
 * `useBottomSheetBackHandler` and the props types out.
 */

/**
 * The shell, and the tray that still renders its own modal. `BottomSheetLayout`
 * and `BottomSheetAction` folded INTO `Sheet` — its `view`, `form` and `action`
 * modes are what they were.
 */
const SHELL = [
  'src/components/templates/Sheet.tsx',
  'src/components/templates/ActionTray/ActionTray.tsx',
];

/** The one module that wraps gorhom's modal, themed, under gorhom's name. */
const WRAPPER = 'src/hooks/ui/useStandardBottomSheet.tsx';

const isGorhom = (specifier: string) => specifier === '@gorhom/bottom-sheet';
const isWrapper = (specifier: string) =>
  specifier.endsWith('/useStandardBottomSheet');

/**
 * Whether the file imports `BottomSheetModal` as a value, under any name, from
 * a module `from` accepts. A type import (`RefObject<BottomSheetModal>`,
 * `BottomSheetModalProps`) renders nothing.
 */
function importsModal(
  file: string,
  from: (specifier: string) => boolean,
  text?: string,
): boolean {
  return parseSource(file, text).statements.some(
    statement =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      from(statement.moduleSpecifier.text) &&
      statement.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword &&
      !!statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        element =>
          !element.isTypeOnly &&
          (element.propertyName ?? element.name).text === 'BottomSheetModal',
      ),
  );
}

const SOURCES = productionSources();

describe('bottom sheet shell', () => {
  it('catches the modal imported under another name', () => {
    const planted = `
      import { BottomSheetModal as Modal } from '@gorhom/bottom-sheet';
      const ThemedModal = withUnistyles(Modal);`;

    expect(importsModal('planted.tsx', isGorhom, planted)).toBe(true);
    expect(
      importsModal(
        'planted.tsx',
        isGorhom,
        `import type { BottomSheetModal } from '@gorhom/bottom-sheet';`,
      ),
    ).toBe(false);
  });

  it("wraps gorhom's modal in one module", () => {
    expect(SOURCES.filter(file => importsModal(file, isGorhom))).toEqual([
      WRAPPER,
    ]);
  });

  // Exact, both ways: a scan broken into finding nothing fails on the shell's
  // own files, and a hand-rendered modal fails as an extra entry.
  it('only the shell renders the modal', () => {
    expect(SOURCES.filter(file => importsModal(file, isWrapper))).toEqual(
      [...SHELL].sort(),
    );
  });
});
