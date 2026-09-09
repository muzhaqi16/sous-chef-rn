import fs from 'fs';
import path from 'path';

/**
 * A sentence that interpolates an entity noun must not contain a word that
 * agrees with it.
 *
 * The app names entities at runtime through two slots: `{{resource}}`, fed the
 * `errors.resourceNames` map keyed by GraphQL typename, and `{{entity}}`, fed a
 * bare noun. Spanish and Italian articles and participles inflect for the
 * gender of the noun they attach to — but the sentence is fixed at translation
 * time and the noun is chosen at run time, so any agreeing word is right for
 * about half the entities and wrong for the rest. Three shipped that way:
 *
 *   es  "No se pudo encontrar la receta. Es posible que haya sido eliminado…"
 *   it  "La ricetta non è stato trovato."
 *   es  "Invitación actualizado"
 *
 * and a fourth was written and caught before it shipped:
 *
 *   es  "Tu cambio en el la despensa…"   (the frame supplied a second article)
 *   it  "La tua modifica al L'articolo…" (al = a + il)
 *
 * The fix is the one `addresseeGender.test.ts` prescribes for the addressee
 * case: write each locale's frame with no agreeing slot. Spanish and Italian
 * labels carry their own article, so the frame supplies none; English labels
 * are bare, so its frame supplies "the". That asymmetry is the contract.
 *
 * Grammar itself is not checkable here — a participle may correctly agree with
 * some other noun in the sentence. So this test does the half a machine can do,
 * and forces a human to do the other half: it fails a determiner immediately
 * before a slot, and it fails any NEW interpolation site until someone adds it
 * to REVIEWED_SLOTS, having read every label rendered into it.
 */
const LOCALES_DIR = path.join(__dirname, '..', '..', 'src', 'i18n', 'locales');
const LOCALES = ['en', 'es', 'it', 'sq'] as const;

const SLOT = /\{\{(resource|entity)\}\}/;

/**
 * Every key allowed to interpolate an entity noun. Adding one means reading it
 * rendered against all fourteen labels, in all four locales, and saying here
 * what makes it safe.
 */
const REVIEWED_SLOTS: Record<string, string> = {
  // Frame supplies no article in es/it/sq; en supplies "the" because its
  // labels are bare. No participle agrees with the slot in any locale.
  'errors.notFoundResource': 'label leads or follows a verb; no agreeing word',
  // es puts the label after the non-contracting `en`; it/sq lead with it and a
  // colon, so their participles agree with `modifica` / nothing.
  'errors.queuedChangeOverwrittenResource': 'colon frame or `en`; no agreement',
  // Fed bare capitalised nouns, not the resourceNames map. es/it use a colon
  // and a fixed noun rather than a participle.
  'errors.entityUpdatedTitle': 'bare-noun slot; no participle in es/it',
};

/**
 * Determiners that must not sit immediately before a slot whose label carries
 * its own. Includes the prepositions that CONTRACT with an article — Italian
 * `al` is `a + il`, Spanish `al` is `a + el` — since those are articles too.
 *
 * English is absent on purpose: its labels are bare, so its frames must supply
 * an article.
 */
const DETERMINERS: Record<string, RegExp> = {
  es: /\b(el|la|los|las|un|una|unos|unas|al|del|este|esta|estos|estas|ese|esa)\s+$/i,
  it: /(\b(il|lo|la|i|gli|le|un|uno|una|al|allo|alla|del|dello|della|nel|nello|nella|dal|dalla|sul|sulla|questo|questa|questi|queste)\s+$|\b(l|un|all|dell|nell|dall|sull)['’]$)/i,
  sq: /\b(ky|kjo|këtë|këta|këto|atë|ai|ajo)\s+$/i,
};

type Entry = { locale: string; key: string; value: string };

const flatten = (node: unknown, prefix = ''): [string, string][] => {
  if (typeof node === 'string') return [[prefix, node]];
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
};

const entries: Entry[] = LOCALES.flatMap(locale =>
  flatten(
    JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf8')),
  )
    .filter(([, value]) => SLOT.test(value))
    .map(([key, value]) => ({ locale, key, value })),
);

describe('an interpolated entity noun has nothing agreeing with it', () => {
  it('finds the slots at all, so a rename cannot empty this test', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(LOCALES)('%s supplies no determiner before the slot', locale => {
    const pattern = DETERMINERS[locale];
    if (!pattern) return; // en: bare labels, so its frames must supply one.

    const offenders = entries
      .filter(e => e.locale === locale)
      .filter(e => pattern.test(e.value.slice(0, e.value.search(SLOT))))
      .map(e => `${e.key}: ${e.value}`);

    expect(offenders).toEqual([]);
  });

  it('interpolates an entity noun only where someone reviewed it', () => {
    const unreviewed = [
      ...new Set(
        entries.filter(e => !REVIEWED_SLOTS[e.key]).map(e => e.key),
      ),
    ];

    expect(unreviewed).toEqual([]);
  });

  it('keeps no review note for a slot that no longer exists', () => {
    const live = new Set(entries.map(e => e.key));
    expect(Object.keys(REVIEWED_SLOTS).filter(k => !live.has(k))).toEqual([]);
  });
});
