import type { Schema } from 'yup';
import {
  getCreateHomeSchema,
  createShoppingListSchema,
  getCreateShoppingListSchema,
  inviteMembersSchema,
  getInviteMembersSchema,
  selectPantryItemsSchema,
  getSelectPantryItemsSchema,
} from '../onboarding';

const validate = async (schema: Schema, data: Record<string, unknown>) => {
  try {
    await schema.validate(data);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
};

describe('onboarding validation', () => {
  describe('getCreateHomeSchema', () => {
    it('requires homeName when needsHome is true', async () => {
      const schema = getCreateHomeSchema(true);
      const msg = await validate(schema, { pantryName: 'Kitchen' });
      expect(msg).toContain('Home name');
    });

    it('does not require homeName when needsHome is false', async () => {
      const schema = getCreateHomeSchema(false);
      expect(await validate(schema, { pantryName: 'Kitchen' })).toBeNull();
    });

    it('always requires pantryName', async () => {
      const schema = getCreateHomeSchema(false);
      const msg = await validate(schema, {});
      expect(msg).toContain('Pantry name');
    });

    it('accepts valid home and pantry names', async () => {
      const schema = getCreateHomeSchema(true);
      expect(
        await validate(schema, {
          homeName: 'My Home',
          pantryName: 'Kitchen Pantry',
        }),
      ).toBeNull();
    });

    it('rejects home name under 2 chars', async () => {
      const schema = getCreateHomeSchema(true);
      const msg = await validate(schema, {
        homeName: 'A',
        pantryName: 'Kitchen',
      });
      expect(msg).toContain('2');
    });

    it('rejects home name over 50 chars', async () => {
      const schema = getCreateHomeSchema(true);
      const msg = await validate(schema, {
        homeName: 'a'.repeat(51),
        pantryName: 'Kitchen',
      });
      expect(msg).toContain('50');
    });

    it('rejects home name with special chars', async () => {
      const schema = getCreateHomeSchema(true);
      const msg = await validate(schema, {
        homeName: 'Home@#',
        pantryName: 'Kitchen',
      });
      expect(msg).toBeTruthy();
    });

    it('allows hyphens and apostrophes in home name', async () => {
      const schema = getCreateHomeSchema(true);
      expect(
        await validate(schema, {
          homeName: "O'Brien's Home",
          pantryName: 'Kitchen',
        }),
      ).toBeNull();
    });

    it('rejects pantry name under 2 chars', async () => {
      const schema = getCreateHomeSchema(false);
      const msg = await validate(schema, { pantryName: 'K' });
      expect(msg).toContain('2');
    });

    it('defaults needsHome to true', async () => {
      const schema = getCreateHomeSchema();
      const msg = await validate(schema, { pantryName: 'Kitchen' });
      expect(msg).toContain('Home name');
    });
  });

  describe('createShoppingListSchema', () => {
    it('accepts valid shopping list name', async () => {
      expect(
        await validate(createShoppingListSchema, {
          shoppingListName: 'Weekly Groceries',
        }),
      ).toBeNull();
    });

    it('rejects missing name', async () => {
      const msg = await validate(createShoppingListSchema, {});
      expect(msg).toBeTruthy();
    });

    it('rejects name under 2 chars', async () => {
      const msg = await validate(createShoppingListSchema, {
        shoppingListName: 'A',
      });
      expect(msg).toContain('2');
    });

    it('rejects name over 50 chars', async () => {
      const msg = await validate(createShoppingListSchema, {
        shoppingListName: 'a'.repeat(51),
      });
      expect(msg).toContain('50');
    });
  });

  describe('getCreateShoppingListSchema', () => {
    it('returns the schema', () => {
      expect(getCreateShoppingListSchema()).toBe(createShoppingListSchema);
    });
  });

  describe('inviteMembersSchema', () => {
    it('accepts valid email', async () => {
      expect(
        await validate(inviteMembersSchema, { email: 'test@example.com' }),
      ).toBeNull();
    });

    it('rejects invalid email', async () => {
      const msg = await validate(inviteMembersSchema, { email: 'invalid' });
      expect(msg).toBeTruthy();
    });

    it('rejects missing email', async () => {
      const msg = await validate(inviteMembersSchema, {});
      expect(msg).toBeTruthy();
    });
  });

  describe('getInviteMembersSchema', () => {
    it('returns the schema', () => {
      expect(getInviteMembersSchema()).toBe(inviteMembersSchema);
    });
  });

  describe('selectPantryItemsSchema', () => {
    it('accepts up to 5 items', async () => {
      expect(
        await validate(selectPantryItemsSchema, {
          selectedItems: ['a', 'b', 'c', 'd', 'e'],
        }),
      ).toBeNull();
    });

    it('rejects more than 5 items', async () => {
      const msg = await validate(selectPantryItemsSchema, {
        selectedItems: ['a', 'b', 'c', 'd', 'e', 'f'],
      });
      expect(msg).toContain('5');
    });

    it('accepts empty array', async () => {
      expect(
        await validate(selectPantryItemsSchema, { selectedItems: [] }),
      ).toBeNull();
    });
  });

  describe('getSelectPantryItemsSchema', () => {
    it('returns the schema', () => {
      expect(getSelectPantryItemsSchema()).toBe(selectPantryItemsSchema);
    });
  });
});
