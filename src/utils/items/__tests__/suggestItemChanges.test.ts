import {
  BaseDimension,
  ItemType,
  StorageState,
} from '#/graphql/generated/schemaTypes';
import {
  buildSuggestibleItemChanges,
  type EditableItemSnapshot,
} from '../suggestItemChanges';
import type { AddItemFormData } from '../createItemMapping';

const snapshot = (
  overrides: Partial<EditableItemSnapshot> = {},
): EditableItemSnapshot => ({
  id: 'item-1',
  canEdit: false,
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

  // `brand` is additive and never displaces what's already there, so swapping a
  // brand needs the explicit removal alongside it — otherwise the item approves
  // with BOTH brands attached.
  it('pairs a brand swap with the removal of the old one', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ brandId: 'brand-2', brandName: 'Globex' }),
    );

    expect(diff.changes.brand).toEqual({ brandId: 'brand-2' });
    expect(diff.changes.brandOps).toEqual({ removeBrandIds: ['brand-1'] });
  });

  it('omits the removal when the item had no brand to displace', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot({ brandId: undefined, brandName: undefined }),
      unchangedForm({ brandId: 'brand-2', brandName: 'Globex' }),
    );

    expect(diff.changes.brand).toEqual({ brandId: 'brand-2' });
    expect(diff.changes).not.toHaveProperty('brandOps');
  });

  // brandName is find-or-create server-side — the only way to name a brand the
  // catalog doesn't have yet, so a typed brand must not be dropped.
  it('sends a free-typed brand by name when it matched nothing', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ brandId: undefined, brandName: 'Typed Brand' }),
    );

    expect(diff.changes.brand).toEqual({ brandName: 'Typed Brand' });
    expect(diff.changes.brandOps).toEqual({ removeBrandIds: ['brand-1'] });
  });

  it('treats a re-typed identical brand name as unchanged', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ brandId: undefined, brandName: 'Acme' }),
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

  // media.images is a set-replace that drops every row it omits, and photos
  // already go live additively via confirmItemImageUpload.
  it('never includes media, even when an image is present', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ name: 'Skim Milk', imageUrl: 'https://x/new.png' }),
    );

    expect(diff.changes).not.toHaveProperty('media');
  });

  // classification.tags already set-replaces the prefilled list, so tagOps
  // would only restate it in more fields.
  it('expresses a tag change through classification.tags alone', () => {
    const diff = buildSuggestibleItemChanges(
      snapshot(),
      unchangedForm({ tags: ['brand-new'] }),
    );

    expect(diff.changes.classification).toEqual({ tags: ['brand-new'] });
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

  // The unit field holds typed text rather than the id packageInfo expects, so
  // there is no round-trippable surface to diff these against.
  it('never includes the consume packageInfo fields', () => {
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
