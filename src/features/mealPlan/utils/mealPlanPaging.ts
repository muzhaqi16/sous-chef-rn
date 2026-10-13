/**
 * The server's largest page. A plan's or a template's meals are read at it, so
 * anything up to a hundred meals is one request; a longer one follows the
 * cursor. Sent as a variable: the server's cost rule multiplies a literal
 * `first` into the selection beneath it.
 */
export const MEALS_PAGE_SIZE = 100;
