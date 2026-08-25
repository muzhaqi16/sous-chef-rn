/**
 * Probe: does a prop injected by RNGH's `cloneElement` survive `withUnistyles`?
 *
 * RNGH's v3 ScrollView hands its scroll gesture to the refresh control as
 * `cloneElement(refreshControl, { block: scrollGesture })`. Our control is
 * `withUnistyles(RefreshControl, theme => ({ colors, tintColor }))`, so the
 * injected prop has to cross that wrapper by REFERENCE — a NativeGesture that
 * got cloned or flattened would be a different object and the arbitration
 * would silently not happen.
 *
 * withUnistyles builds `finalProps` as
 * `deepMergeObjects(mappingsProps, unistyleProps, props)` and spreads it onto
 * the wrapped component, so `deepMergeObjects` is the only thing between the
 * injected prop and the native wrapper. This runs the real implementation.
 */
import { readFileSync } from 'node:fs';

const SRC = 'node_modules/react-native-unistyles/src/utils.ts';
const source = readFileSync(SRC, 'utf8');

// The package ships TS; lift the one function out rather than adding a build step.
const start = source.indexOf('export const deepMergeObjects');
const end = source.indexOf('export const copyComponentProperties');
const body = source
  .slice(start, end)
  .replace('export const deepMergeObjects', 'const deepMergeObjects')
  .replace(/<T extends Record<PropertyKey, any>>/, '')
  .replace(/: Array<T>/, '')
  .replace(/ as T/g, '')
  .replace(/\/\/ @ts-expect-error.*\n/g, '')
  .replace(
    /\.filter\(isDefined\)/,
    '.filter(s => s !== undefined && s !== null)',
  );

const deepMergeObjects = new Function(`${body}; return deepMergeObjects;`)();

// Stand-ins for the three sources withUnistyles merges, in its order.
const scrollGesture = { __nativeGesture: true, handlerTag: 42 };
const mappingsProps = { colors: ['#7C3AED'], tintColor: '#7C3AED' };
const unistyleProps = {};
const props = { refreshing: false, onRefresh: () => {}, block: scrollGesture };

const finalProps = deepMergeObjects(mappingsProps, unistyleProps, props);

const sameReference = finalProps.block === scrollGesture;
const themeKept = finalProps.tintColor === '#7C3AED';

console.log('block present:      ', 'block' in finalProps);
console.log('block ===  gesture: ', sameReference);
console.log('theme mapping kept: ', themeKept);

if (!sameReference || !themeKept) {
  console.error(
    '\nFAIL — withUnistyles does not pass the injected gesture through by reference.',
  );
  process.exit(1);
}
console.log(
  '\nPASS — an injected `block` crosses withUnistyles by reference, and the theme mapping survives.',
);
