import { Kind, type DocumentNode, type SelectionSetNode } from 'graphql';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { LoginUserFragmentDoc } from '#operations/auth/userFragments.generated';
import { MIRRORED_SETTING_KEYS, SETTING_KEYS } from '#/domain/serverSettings';

/** The field names selected under `settings`, wherever it sits in a document. */
function settingsFields(document: DocumentNode): Set<string> {
  const found = new Set<string>();
  const walk = (set: SelectionSetNode | undefined, inSettings: boolean) => {
    for (const selection of set?.selections ?? []) {
      if (selection.kind !== Kind.FIELD) continue;
      if (inSettings) found.add(selection.name.value);
      walk(selection.selectionSet, selection.name.value === 'settings');
    }
  };
  for (const definition of document.definitions) {
    if ('selectionSet' in definition) walk(definition.selectionSet, false);
  }
  return found;
}

/**
 * `serverSettings.ts` is the one list of the account's settings. A setting it
 * names that a document leaves out reads as its default on every device.
 */
describe('the server settings registry', () => {
  it('names only settings the settings read selects', () => {
    const selected = settingsFields(GetUserSettingsDocument);
    expect(SETTING_KEYS.filter(key => !selected.has(key))).toEqual([]);
  });

  // Sign-in seeds the mirror, so a new device paints the account's values.
  it('mirrors only settings the sign-in payload selects', () => {
    const selected = settingsFields(LoginUserFragmentDoc);
    expect(MIRRORED_SETTING_KEYS.filter(key => !selected.has(key))).toEqual([]);
  });
});
