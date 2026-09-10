/**
 * Builds a selection handler for the add-details forms, where picking an
 * autocomplete entry sets an id and (when a display name is present) a name.
 * The name setter runs only for a truthy name so clearing the id leaves the
 * last typed name in place, matching the hand-written handlers it replaces.
 */
export function makeIdNameHandler(
  setId: (id: string | null) => void,
  setName: (name: string) => void,
): (id: string | null, name: string | null) => void {
  return (id, name) => {
    setId(id);
    if (name) setName(name);
  };
}
