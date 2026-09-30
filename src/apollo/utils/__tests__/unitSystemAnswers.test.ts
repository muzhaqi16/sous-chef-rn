import { makeCache } from '#/apollo/cache';
import {
  dropUnitSystemAnswers,
  reconcileSettingsReplay,
} from '#/apollo/utils/unitSystemAnswers';

const rootFields = (cache: ReturnType<typeof makeCache>) =>
  Object.keys(cache.extract().ROOT_QUERY ?? {});

describe('dropUnitSystemAnswers', () => {
  it('drops both pickers, so each is asked again in the new system', () => {
    const cache = makeCache();
    cache.restore({
      ROOT_QUERY: {
        __typename: 'Query',
        'consumptionUnitsForPantryItem({"pantryItemId":"p1"})': [],
        'restockUnitsForPantryItem({"pantryItemId":"p1"})': [],
        me: null,
      },
    });

    dropUnitSystemAnswers(cache);

    expect(rootFields(cache)).toEqual(['__typename', 'me']);
  });
});

describe('reconcileSettingsReplay', () => {
  const replay = (input: Record<string, unknown>) => {
    const cache = makeCache();
    cache.restore({
      ROOT_QUERY: {
        __typename: 'Query',
        'consumptionUnitsForPantryItem({"pantryItemId":"p1"})': [],
      },
    });
    reconcileSettingsReplay(cache, { input }, null);
    return rootFields(cache);
  };

  it('drops the pickers when the replayed write set the unit system', () => {
    expect(replay({ regional: { preferredUnitSystem: 'IMPERIAL' } })).toEqual([
      '__typename',
    ]);
  });

  it('keeps them for a settings write that left the unit system alone', () => {
    expect(replay({ regional: { language: 'es' } })).toContain(
      'consumptionUnitsForPantryItem({"pantryItemId":"p1"})',
    );
    expect(replay({ ui: { theme: 'DARK' } })).toContain(
      'consumptionUnitsForPantryItem({"pantryItemId":"p1"})',
    );
  });
});
