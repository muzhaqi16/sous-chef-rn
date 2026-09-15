/**
 * Narrows a runtime string to a key of `obj`. Own keys only, so an inherited
 * name like `constructor` is not a key. Sound for a table whose runtime keys
 * are its declared ones; a structurally typed value may carry extra keys.
 */
export function isOwnKey<T extends object>(
  obj: T,
  key: PropertyKey,
): key is keyof T {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
