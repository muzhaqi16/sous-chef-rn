/**
 * The core-portability project's transform: what any host must run over the
 * core and nothing from React Native's toolchain, so a core file that loads
 * here needs no React-Native-specific transform. The React Compiler is a
 * correctness dependency of the core (docs/web-host-decision.md); the aliases
 * and `__DEV__` come from the project's `moduleNameMapper` and `globals`.
 */
module.exports = {
  babelrc: false,
  plugins: [
    // The compiler first, as its documentation requires.
    'babel-plugin-react-compiler',
    ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }],
  ],
  presets: [
    [
      '@babel/preset-env',
      { targets: { node: 'current' }, modules: 'commonjs' },
    ],
    '@babel/preset-typescript',
  ],
};
