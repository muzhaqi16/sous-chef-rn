/**
 * A removal, by its schema field name. It returns the removed entities' keys
 * (the client evicts them) and the collections they left in full: a returned
 * parent type is owed unless it is the type the noun names (`deleteShoppingList`).
 *
 * CommonJS because the ESLint config loads it before any transform runs.
 */
const REMOVAL = /^(?:delete|remove|purge|decline|revoke|leave)([A-Z]\w*)$/;

module.exports = { REMOVAL };
