import {
  itemNameRule,
  descriptionRule,
  upcRule,
  skuRule,
  shelfLifeDaysRule,
  shelfLifeOpenedDaysRule,
  tagsRule,
  createItemSchema,
} from '../item';

const validateRule = async (rule: any, value: unknown) => {
  try {
    await rule.validate(value);
    return null;
  } catch (err: any) {
    return err.message;
  }
};

const validateSchema = async (data: Record<string, unknown>) => {
  try {
    await createItemSchema.validate(data);
    return null;
  } catch (err: any) {
    return err.message;
  }
};

describe('item validation', () => {
  describe('itemNameRule', () => {
    it('accepts valid item names', async () => {
      expect(await validateRule(itemNameRule, 'Milk')).toBeNull();
      expect(await validateRule(itemNameRule, "Trader Joe's Salsa")).toBeNull();
      expect(await validateRule(itemNameRule, 'Item (500g)')).toBeNull();
      expect(await validateRule(itemNameRule, 'Salt & Pepper')).toBeNull();
    });

    it('rejects empty name', async () => {
      const msg = await validateRule(itemNameRule, '');
      expect(msg).toBeTruthy();
    });

    it('rejects name over 100 chars', async () => {
      const msg = await validateRule(itemNameRule, 'a'.repeat(101));
      expect(msg).toContain('100');
    });

    it('rejects special characters', async () => {
      const msg = await validateRule(itemNameRule, 'Item@#$');
      expect(msg).toBeTruthy();
    });
  });

  describe('descriptionRule', () => {
    it('accepts valid description', async () => {
      expect(await validateRule(descriptionRule, 'A great item')).toBeNull();
    });

    it('rejects over 500 chars', async () => {
      const msg = await validateRule(descriptionRule, 'x'.repeat(501));
      expect(msg).toContain('500');
    });

    it('allows undefined (optional)', async () => {
      expect(await validateRule(descriptionRule, undefined)).toBeNull();
    });
  });

  describe('upcRule', () => {
    it('accepts valid UPC codes', async () => {
      expect(await validateRule(upcRule, '12345678')).toBeNull();
      expect(await validateRule(upcRule, '012345678901')).toBeNull();
    });

    it('rejects non-numeric UPC', async () => {
      const msg = await validateRule(upcRule, '1234ABCD');
      expect(msg).toBeTruthy();
    });

    it('rejects UPC under 8 digits', async () => {
      const msg = await validateRule(upcRule, '1234567');
      expect(msg).toContain('8');
    });

    it('rejects UPC over 18 digits', async () => {
      const msg = await validateRule(upcRule, '1'.repeat(19));
      expect(msg).toContain('18');
    });

    it('allows undefined (optional)', async () => {
      expect(await validateRule(upcRule, undefined)).toBeNull();
    });
  });

  describe('skuRule', () => {
    it('accepts valid SKU', async () => {
      expect(await validateRule(skuRule, 'SKU-001')).toBeNull();
    });

    it('rejects over 50 chars', async () => {
      const msg = await validateRule(skuRule, 'x'.repeat(51));
      expect(msg).toContain('50');
    });
  });

  describe('shelfLifeDaysRule', () => {
    it('accepts valid days', async () => {
      expect(await validateRule(shelfLifeDaysRule, 30)).toBeNull();
      expect(await validateRule(shelfLifeDaysRule, 1)).toBeNull();
      expect(await validateRule(shelfLifeDaysRule, 3650)).toBeNull();
    });

    it('rejects 0 days', async () => {
      const msg = await validateRule(shelfLifeDaysRule, 0);
      expect(msg).toBeTruthy();
    });

    it('rejects over 3650 days', async () => {
      const msg = await validateRule(shelfLifeDaysRule, 3651);
      expect(msg).toContain('10 years');
    });

    it('rejects non-integer', async () => {
      const msg = await validateRule(shelfLifeDaysRule, 1.5);
      expect(msg).toBeTruthy();
    });

    it('allows undefined (optional)', async () => {
      expect(await validateRule(shelfLifeDaysRule, undefined)).toBeNull();
    });
  });

  describe('shelfLifeOpenedDaysRule', () => {
    it('accepts valid days', async () => {
      expect(await validateRule(shelfLifeOpenedDaysRule, 30)).toBeNull();
      expect(await validateRule(shelfLifeOpenedDaysRule, 1)).toBeNull();
      expect(await validateRule(shelfLifeOpenedDaysRule, 3650)).toBeNull();
    });

    it('rejects 0 days', async () => {
      const msg = await validateRule(shelfLifeOpenedDaysRule, 0);
      expect(msg).toBeTruthy();
    });

    it('rejects over 3650 days', async () => {
      const msg = await validateRule(shelfLifeOpenedDaysRule, 3651);
      expect(msg).toContain('10 years');
    });

    it('rejects non-integer', async () => {
      const msg = await validateRule(shelfLifeOpenedDaysRule, 1.5);
      expect(msg).toBeTruthy();
    });

    it('allows undefined (optional)', async () => {
      expect(await validateRule(shelfLifeOpenedDaysRule, undefined)).toBeNull();
    });
  });

  describe('tagsRule', () => {
    it('accepts valid tags', async () => {
      expect(await validateRule(tagsRule, ['organic', 'fresh'])).toBeNull();
    });

    it('rejects more than 10 tags', async () => {
      const tags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
      const msg = await validateRule(tagsRule, tags);
      expect(msg).toContain('10');
    });

    it('rejects tags over 30 chars', async () => {
      const msg = await validateRule(tagsRule, ['x'.repeat(31)]);
      expect(msg).toContain('30');
    });
  });

  describe('createItemSchema', () => {
    it('validates a minimal valid item', async () => {
      expect(await validateSchema({ name: 'Milk' })).toBeNull();
    });

    it('validates a complete item', async () => {
      const data = {
        name: 'Organic Milk',
        description: 'Fresh organic milk',
        upc: '123456789012',
        shelfLifeDays: 14,
        shelfLifeOpenedDays: 7,
        tags: ['organic', 'dairy'],
        categoryIds: ['cat-1'],
      };
      expect(await validateSchema(data)).toBeNull();
    });

    it('rejects missing name', async () => {
      const msg = await validateSchema({});
      expect(msg).toBeTruthy();
    });
  });
});
