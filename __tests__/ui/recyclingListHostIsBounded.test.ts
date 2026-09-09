import { readFileSync } from 'fs';
import { sync as glob } from 'glob';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

/**
 * A list that recycles its rows claims the free space its container offers and
 * contributes no height of its own — flash-list's root is `flex: 1`, so
 * `flexBasis: 0`. A plain `View` that sizes to its children therefore offers
 * nothing to claim, and the list resolves to zero height: no rows, no error,
 * and nothing a test asserting on data or props can see.
 *
 * `FlatList` survives the same container because RN's `ScrollView` base style
 * uses `flexBasis: auto`, which is why a swap from one to the other empties a
 * picker that worked.
 */

/** Style props that give a `View` a height independent of its children. */
const boundsHeight = (body: string): boolean =>
  /\bheight:/.test(body) ||
  /\bflex:/.test(body) ||
  /flexGrow/.test(body) ||
  /flexBasis/.test(body) ||
  /position:\s*['"]absolute/.test(body);

/** The literal body of `key: { … }` in the file's StyleSheet block. */
const styleBody = (src: string, key: string): string => {
  const start = src.search(new RegExp(`\\b${key}:\\s*\\{`));
  if (start === -1) return '';
  const from = src.indexOf('{', start);
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(from, i + 1);
  }
  return '';
};

/**
 * Plain view containers only. A context provider or a template renders no view
 * of its own, so its own tag says nothing about the height reaching the list —
 * that question belongs to whatever the provider renders into.
 */
const PLAIN_VIEWS = new Set(['View', 'Animated.View']);

type Finding = { file: string; host: string; styles: string[] };

const findUnboundedHosts = (file: string, src: string): Finding[] => {
  const found: Finding[] = [];
  const ast = parse(src, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  traverse(ast, {
    JSXElement(path) {
      const name = path.node.openingElement.name;
      if (name.type !== 'JSXIdentifier' || name.name !== 'FlashList') return;
      const hostPath = path.findParent(parent => parent.isJSXElement());
      if (!hostPath || !hostPath.isJSXElement()) return;
      const hostName = hostPath.node.openingElement.name;
      const hostLabel =
        hostName.type === 'JSXIdentifier'
          ? hostName.name
          : src.slice(hostName.start ?? 0, hostName.end ?? 0);
      if (!PLAIN_VIEWS.has(hostLabel)) return;
      const styleAttr = hostPath.node.openingElement.attributes.find(
        attribute =>
          attribute.type === 'JSXAttribute' && attribute.name.name === 'style',
      );
      if (!styleAttr) return;
      const text = src.slice(styleAttr.start ?? 0, styleAttr.end ?? 0);
      const keys = [...text.matchAll(/styles\.(\w+)/g)].map(match => match[1]!);
      if (keys.some(key => boundsHeight(styleBody(src, key)))) return;
      found.push({ file, host: hostLabel, styles: keys });
    },
  });
  return found;
};

describe('a recycling list is bounded by the view that hosts it', () => {
  const files = glob('src/**/*.tsx', { ignore: ['**/__tests__/**'] })
    .map(file => ({ file, src: readFileSync(file, 'utf8') }))
    .filter(({ src }) => /<FlashList\b/.test(src));

  it('finds the recycling lists to check', () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it('gives every list a host that establishes a height', () => {
    const findings = files.flatMap(({ file, src }) =>
      findUnboundedHosts(file, src),
    );
    expect(
      findings.map(
        finding =>
          `${finding.file}: <${finding.host} style=[${finding.styles.join(', ')}]> sizes to its children, so the list inside it resolves to zero height`,
      ),
    ).toEqual([]);
  });
});
