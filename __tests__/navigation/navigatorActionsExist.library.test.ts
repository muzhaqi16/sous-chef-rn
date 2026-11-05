import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  CommonActions,
  StackActions,
  TabActions,
} from '@react-navigation/native';

/**
 * A navigator package calls its router's action creators by name, and nothing
 * checks the pair when one moves without the other: a creator the router has
 * renamed throws only when the call runs, such as when the OS dismisses a
 * native-stack screen. `docs/verified-library-behaviour.md`
 * § Navigator packages call the router's action creators by name.
 */
const NAVIGATORS = [
  '@react-navigation/native-stack',
  '@react-navigation/bottom-tabs',
  '@react-navigation/elements',
];

const CREATORS: Record<string, Record<string, unknown>> = {
  StackActions,
  TabActions,
  CommonActions,
};
const CALL = /\b(StackActions|TabActions|CommonActions)\.(\w+)\(/g;

function moduleFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return moduleFiles(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

const calls = NAVIGATORS.flatMap(name => {
  const lib = join(__dirname, '..', '..', 'node_modules', name, 'lib', 'module');
  return moduleFiles(lib).flatMap(file =>
    [...readFileSync(file, 'utf8').matchAll(CALL)].map(
      ([, group = '', creator = '']) => ({
        call: `${group}.${creator}`,
        group,
        creator,
        file: file.slice(file.indexOf(name)),
      }),
    ),
  );
});

describe('navigator packages and the router they call', () => {
  // An empty scan (a moved build folder) must not pass as agreement.
  it('finds the stack actions native-stack dispatches', () => {
    expect(calls.map(found => found.call)).toEqual(
      expect.arrayContaining(['StackActions.pop', 'StackActions.dismiss']),
    );
  });

  it.each(calls)('$call in $file exists', ({ group, creator }) => {
    expect(typeof CREATORS[group]?.[creator]).toBe('function');
  });
});
