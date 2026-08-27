/**
 * Re-crawl Babel's scope between the Unistyles plugin and the React Compiler.
 *
 * `extractVariants` in react-native-unistyles@3.3.0 (plugin/index.js) rewrites a
 * component body that calls `styles.useVariants(...)`: it inserts
 * `const _styles = styles;`, wraps every following statement in a NEW
 * BlockStatement, and inside it declares a shadowing
 * `const styles = _styles.useVariants(args)`. It does that by assigning
 * `path.node.body` directly and never calls `path.scope.crawl()`, so Babel's
 * scope table has no binding for the declaration it just created.
 *
 * babel-plugin-react-compiler cannot resolve that binding and aborts the whole
 * function with `(BuildHIR::lowerAssignment) Could not find binding for
 * declaration`.
 *
 * Crawling here restores the binding, so the documented order works and the
 * style read lands in the compiler's cache key:
 *
 *   if ($[2] !== style || $[3] !== styles$0.button) { ... }
 *
 * MUST run at `Program.enter`, and MUST sit between the Unistyles plugin and
 * the compiler in `babel.config.js`. Babel interleaves visitors in array order
 * per node, so `Program.enter` is the only phase where the crawl lands after
 * Unistyles has rewritten the body and before the compiler analyses it. At
 * `Program.exit` the compiler has already run and the crawl is a silent no-op,
 * indistinguishable from omitting this plugin.
 *
 * Remove this once the missing `scope.crawl()` is fixed upstream; re-check with
 * `node scripts/probe-unistyles-compiler-order.mjs`.
 */
module.exports = function unistylesScopeCrawl() {
  return {
    name: 'unistyles-scope-crawl',
    visitor: {
      Program: {
        enter(path) {
          path.scope.crawl();
        },
      },
    },
  };
};
