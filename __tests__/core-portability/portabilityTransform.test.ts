import * as path from 'node:path';

/**
 * The core is compiled here as any host must compile it: with the React
 * Compiler, which its hooks rely on for stable identities, and with nothing
 * from React Native's toolchain. See docs/web-host-decision.md.
 */
type BabelEntry = string | [string, unknown];
type BabelConfig = { plugins: BabelEntry[]; presets: BabelEntry[] };
type JestProject = {
  displayName?: string;
  transform?: Record<string, [string, { configFile?: string }]>;
};

const config = require('./babel.config.js') as BabelConfig;
const { projects } = require('../../jest.config.js') as {
  projects: JestProject[];
};

const nameOf = (entry: BabelEntry) =>
  typeof entry === 'string' ? entry : entry[0];
const names = [...config.plugins, ...config.presets].map(nameOf);

describe('a host compiles the core with the React Compiler', () => {
  it('runs the React Compiler', () => {
    expect(names).toContain('babel-plugin-react-compiler');
  });

  it('runs nothing from React Native’s toolchain', () => {
    expect(
      names.filter(name =>
        /react-native|unistyles|worklets|reanimated|module-resolver/.test(
          name,
        ),
      ),
    ).toEqual([]);
  });

  it('is the transform the core-portability project runs', () => {
    const project = projects.find(
      entry => entry.displayName === 'core-portability',
    );
    const transforms = Object.values(project?.transform ?? {});
    expect(transforms.map(([, options]) => options.configFile)).toEqual([
      path.join(__dirname, 'babel.config.js'),
    ]);
  });
});
