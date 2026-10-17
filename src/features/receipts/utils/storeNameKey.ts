import { isOwnKey } from '#/utils/isOwnKey';

// Letters with no accent to strip, read as the API reads them: ø is o, ß is ss.
const LETTER_FOLDS = {
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  ħ: 'h',
  þ: 'th',
  ı: 'i',
  ς: 'σ',
};

/**
 * A store's name as the API keys it (`storeNameKey`, sous-chef-api
 * `utils/storeMatchKey.ts`): its letters and digits, accents and case folded,
 * so "Giant Eagle" meets "GIANT EAGLE" and "East End Food Co-Op" "east end
 * food coop". Empty for a name with no letter or digit.
 */
export function storeNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[øæœßłđðħþıς]/gu, letter =>
      isOwnKey(LETTER_FOLDS, letter) ? LETTER_FOLDS[letter] : letter,
    )
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]/gu, '');
}
