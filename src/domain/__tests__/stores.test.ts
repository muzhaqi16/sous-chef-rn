import { t } from '#/i18n';
import { UnitSystem } from '#/graphql/generated/schemaTypes';
import {
  chainOption,
  describeStoreOption,
  storeBranchLabel,
  storeChoiceKey,
  storeChoiceOf,
  storeChoiceTarget,
  storeOption,
} from '../stores';

const wilkinsburg = {
  id: 's-aldi-w',
  name: 'ALDI Wilkinsburg',
  address: '401 Penn Ave, Wilkinsburg, PA',
};
const aldi = { id: 'chain-aldi', name: 'ALDI' };

describe('a store choice', () => {
  it('is keyed and targeted by its store, else its chain', () => {
    expect(storeChoiceKey({ store: wilkinsburg })).toBe('store:s-aldi-w');
    expect(storeChoiceKey({ chain: aldi })).toBe('chain:chain-aldi');
    expect(storeChoiceTarget({ store: wilkinsburg })).toEqual({
      storeId: 's-aldi-w',
    });
    expect(storeChoiceTarget({ chain: aldi })).toEqual({
      chainId: 'chain-aldi',
    });
  });

  it('is read off a record naming a store, else a chain', () => {
    expect(storeChoiceOf({ store: wilkinsburg, chain: aldi })).toEqual({
      store: { id: 's-aldi-w', name: 'ALDI Wilkinsburg' },
    });
    expect(storeChoiceOf({ store: null, chain: aldi })).toEqual({
      chain: aldi,
    });
    expect(storeChoiceOf({ store: null, chain: null })).toBeNull();
  });
});

describe('storeBranchLabel', () => {
  it('tells branches apart by address, else by store number', () => {
    expect(storeBranchLabel({ address: '1 Main St', storeNumber: '87' }, t)).toBe(
      '1 Main St',
    );
    expect(storeBranchLabel({ address: '  ', storeNumber: '87' }, t)).toBe(
      'Store #87',
    );
    expect(storeBranchLabel({}, t)).toBeUndefined();
  });
});

describe('describeStoreOption', () => {
  it('reads a store by name, then its branch and distance', () => {
    expect(
      describeStoreOption(
        storeOption(wilkinsburg, { distanceKm: 6.4 }),
        t,
        UnitSystem.Imperial,
      ),
    ).toEqual({
      title: 'ALDI Wilkinsburg',
      subtitle: '401 Penn Ave, Wilkinsburg, PA · 4 mi',
    });
  });

  it('reads a whole chain as any of its stores, with no subtitle', () => {
    expect(
      describeStoreOption(chainOption(aldi), t, UnitSystem.Metric),
    ).toEqual({ title: 'ALDI (any store)', subtitle: undefined });
  });
});
