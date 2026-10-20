// A subpath of a dependency the core may not load (see `jest.config.js`); the
// require stack under this error names the importer and the subpath.
throw new Error(
  'core-portability: the core loaded a subpath of a React Native package',
);
