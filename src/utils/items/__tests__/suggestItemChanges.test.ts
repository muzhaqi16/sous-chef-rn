import {
  BaseDimension,
  ItemType,
  StorageState,
  Visibility,
} from '#/graphql/generated/schemaTypes';
import {
  buildSuggestibleItemChanges,
  resolveItemEditRoute,
  type EditableItemSnapshot,
} from '../suggestItemChanges';
import type { AddItemFormData } from '../createItemMapping';

const snapshot = (
  overrides: Partial<EditableItemSnapshot> = {},
): EditableItemSnapshot => ({
  id: 'item-1',
  visibility: Visibility.Public,
  name: 'Whole Milk',
  description: 'One gallon of whole milk',
  type: ItemType.Food,
  brandId: 'brand-1',
  brandName: 'Acme',
  storageState: StorageState.Ambient,
  tags: ['organic', 'dairy'],
  primaryUpc: '012345678905',
  shelfLifeDays: 14,
  shelfLifeOpenedDays: 7,
  netWeight: 500,
  displayUnitId: 'unit-g',
  displayUnitName: 'gram',
  baseDimension: BaseDimension.Mass,
  imageUrl: 'https://example.com/milk.png',
  ...overrides,
});

/** A submission that matches the snapshot exactly — the "user changed nothing" baseline. */
const unchangedForm = (
  overrides: Partial<AddItemFormData> = {},
): AddItemFormData => ({
  name: 'Whole Milk',
  description: 'One gallon of whole milk',
  type: ItemType.Food,
  brandId: 'brand-1',
  brandName: 'Acme',
  storageState: StorageState.Ambient,
  tags: ['organic', 'dairy'],
  primaryUpc: '012345678905',
  shelfLifeDays: 14,
  shelfLifeOpenedDays: 7,
  baseDimension: BaseDimension.Mass,
  netWeights: [{ value: 500, unitName: 'gram', unitId: 'unit-g' }],
  ...overrides,
});

describe('resolveItemEditRoute', () => {
  it.each([
    [Visibility.Public, false, 'suggest'],
    [Visibility.Private, false, 'direct'],
    [Visibility.Restricted, false, 'direct'],
    [Visibility.Public, true, 'direct'],
    [Visibility.Private, true, 'direct'],
    [Visibility.Restricted, true, 'direct'],
  ] as const)('%s / admin=%s -> %s', (visibility, isAdmin, expected) => {
    expect(resolveItemEditRoute(visibility, isAdmin)).toBe(expected);
  });
});

describe('buildSuggestibleItemChanges', () => {
  it('reports no changes when the form matches the item', () => {
    const diff = buildSuggestibleItemChanges(snapshot(), unchangedForm());

    expect(diff.hasChanges).toBe(false);
    expect(diff.changes).toEqual({});
    expect(diff.changedFields).toEqual([]);
  });

  it('emits only the changed scalar, leaving siblings out', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ name: 'Skim Milk' }),
    );

    expect(diff.changes).toEqual({ name: 'Skim Milk' });
    expect(diff.changedFields).toEqual(['name']);
  });

  it('treats whitespace-only edits as unchanged', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ name: '  Whole Milk  ' }),
    );

    expect(diff.hasChanges).toBe(false);
  });

  it('never emits an empty string over a real name', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ name: '   ' }),
    );

    expect(diff.changes.name).toBeUndefined();
  });

  it('groups only the changed key inside productDetails', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ shelfLifeDays: 21 }),
    );

    expect(diff.changes.productDetails).toEqual({ shelfLifeDays: 21 });
    expect(diff.changes.classification).toBeUndefined();
    expect(diff.changes.packageInfo).toBeUndefined();
  });

  it('replaces the tag set when tags change', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ tags: ['organic', 'grass-fed'] }),
    );

    expect(diff.changes.classification).toEqual({
      tags: ['organic', 'grass-fed'],
    });
  });

  it('ignores tag reordering and duplicates', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ tags: ['dairy', 'organic', 'dairy'] }),
    );

    expect(diff.hasChanges).toBe(false);
  });

  it('sends an empty tag set when the user clears every tag', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ tags: undefined }),
    );

    expect(diff.changes.classification).toEqual({ tags: [] });
  });

  // brand is destructured away and never read by updateItem, so a `brand`
  // change would approve and silently do nothing. brandOps is the applying path.
  it('expresses a brand change as brandOps, never as brand', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ brandId: 'brand-2', brandName: 'Globex' }),
    );

    expect(diff.changes.brandOps).toEqual({
      addBrandIds: ['brand-2'],
      removeBrandIds: ['brand-1'],
    });
    expect(diff.changes).not.toHaveProperty('brand');
  });

  it('omits removeBrandIds when the item had no brand', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot({ brandId: undefined, brandName: undefined }),
      unchangedForm({ brandId: 'brand-2', brandName: 'Globex' }),
    );

    expect(diff.changes.brandOps).toEqual({ addBrandIds: ['brand-2'] });
  });

  it('ignores a free-typed brand with no id, since brandOps needs one', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ brandId: undefined, brandName: 'Typed Brand' }),
    );

    expect(diff.hasChanges).toBe(false);
  });

  it('diffs net weight and unit from the first entry', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({
        netWeights: [{ value: 750, unitName: 'gram', unitId: 'unit-g' }],
      }),
    );

    expect(diff.changes.packageInfo).toEqual({ netWeight: 750 });
  });

  // media is a no-op on approve for imageUrl and destroys every image row for
  // media.images, so it must never reach `changes`.
  it('never includes media, even when an image is present', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ name: 'Skim Milk', imageUrl: 'https://x/new.png' }),
    );

    expect(diff.changes).not.toHaveProperty('media');
  });

  // tagOps.addTags + removeTags in one call silently drops the adds, and tagOps
  // destructively overrides classification.tags.
  it('never includes tagOps', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ tags: ['brand-new'] }),
    );

    expect(diff.changes).not.toHaveProperty('tagOps');
  });

  // An empty categoryIds array wipes every category on the item.
  it('never includes categoryIds', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ name: 'Skim Milk', categoryIds: [] }),
    );

    expect(diff.changes.classification).toBeUndefined();
  });

  // These three are never read on the update path.
  it('never includes create-only packageInfo fields', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({
        defaultConsumeIncrement: 2,
        defaultConsumeUnitId: 'unit-cup',
      }),
    );

    expect(diff.hasChanges).toBe(false);
  });

  it('collects several changes across groups in one diff', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({
        name: 'Skim Milk',
        storageState: StorageState.Frozen,
        primaryUpc: '999999999999',
      }),
    );

    expect(diff.changes).toEqual({
      name: 'Skim Milk',
      classification: { storageState: StorageState.Frozen },
      productDetails: { primaryUpc: '999999999999' },
    });
    expect(diff.changedFields).toEqual([
      'name',
      'classification.storageState',
      'productDetails.primaryUpc',
    ]);
  });
});
