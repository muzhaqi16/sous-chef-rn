import { readFileSync } from 'fs';
import { sync as glob } from 'glob';

/**
 * gorhom's `BottomSheetView` is `position: absolute` with no bottom and no
 * height, so it bounds nothing. A scrollable inside it that sizes to its
 * parent gets the height of its own content instead and is never scrolled —
 * silently, and only once the person has more rows than the detent shows.
 * A sheet holding one uses `mode="list"`, which hands the child to the modal.
 */

const SCROLLABLES = /<(FlashList|FlatList|SectionList|ScrollView)\b/;
const VIEW_MODE = /mode=["']view["']/;

/**
 * `style={styles.x}` on each scrollable's opening tag. The tag's end is found
 * by brace depth, not by the first `>` — an arrow function in any earlier prop
 * supplies one of those and would cut the search short of the style.
 */
const styleKeysOnScrollables = (src: string): string[] => {
  const keys: string[] = [];
  const re = /<(?:FlashList|FlatList|SectionList|ScrollView)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    let end = m.index;
    for (let i = m.index; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) {
        end = i;
        break;
      }
    }
    const tag = src.slice(m.index, end);
    for (const s of tag.matchAll(/\bstyle=\{styles\.(\w+)\}/g)) keys.push(s[1]);
  }
  return keys;
};

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

describe('a view-mode sheet does not hold an unbounded scrollable', () => {
  const files = glob('src/**/*.tsx', { ignore: ['**/__tests__/**'] })
    .map(file => ({ file, src: readFileSync(file, 'utf8') }))
    .filter(({ src }) => VIEW_MODE.test(src) && SCROLLABLES.test(src));

  it('finds the view-mode sheets to check', () => {
    // A rename that stops this matching would make every case below vacuous.
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map(f => f.file))('%s bounds its scrollable', file => {
    const src = readFileSync(file, 'utf8');
    const unbounded = styleKeysOnScrollables(src).filter(key => {
      const body = styleBody(src, key);
      return /\bflex:\s*1\b/.test(body) && !/\bmaxHeight\b/.test(body);
    });
    expect(unbounded).toEqual([]);
  });
});
