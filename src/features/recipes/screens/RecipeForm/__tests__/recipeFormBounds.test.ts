import { recipeFormSchema, recipeFormDefaults } from '../recipeFormConfig';

const base = () => ({
  ...recipeFormDefaults(),
  name: 'Soup',
  ingredients: [
    {
      id: 'i1',
      name: 'Water',
      quantity: 1,
      isOptional: false,
      sortOrder: 0,
    },
  ],
  steps: [{ id: 's1', instruction: 'Boil water', sortOrder: 0 }],
});

async function firstError(state: unknown): Promise<string | null> {
  try {
    await recipeFormSchema.validate(state, { abortEarly: true });
    return null;
  } catch (e) {
    return (e as { message: string }).message;
  }
}

describe('the recipe form bounds', () => {
  it('accepts a valid recipe', async () => {
    expect(await firstError(base())).toBeNull();
  });

  describe('imageUrl', () => {
    it.each(['https://example.com/a.png', 'http://example.com/a.png', ''])(
      'accepts %p',
      async imageUrl => {
        expect(await firstError({ ...base(), imageUrl })).toBeNull();
      },
    );

    // The API accepts http/https only. Refused server-side, this arrives as a
    // field error on a form the user has already left.
    // Assembled, not written literally: `no-script-url` flags the literal even
    // in a test asserting that the schema refuses it.
    const scriptUrl = `${'java'}${'script'}:alert(1)`;
    it.each(['ftp://example.com/a.png', scriptUrl, 'example.com'])(
      'refuses %p on the field',
      async imageUrl => {
        expect(await firstError({ ...base(), imageUrl })).toContain('http');
      },
    );
  });

  describe('the instructions JSON bound', () => {
    it('refuses more than 1,000 steps', async () => {
      const steps = Array.from({ length: 1001 }, (_, i) => ({
        id: `s${i}`,
        instruction: 'x',
        sortOrder: i,
      }));
      expect(await firstError({ ...base(), steps })).toContain('1000');
    });

    it('accepts exactly 1,000', async () => {
      const steps = Array.from({ length: 1000 }, (_, i) => ({
        id: `s${i}`,
        instruction: 'x',
        sortOrder: i,
      }));
      expect(await firstError({ ...base(), steps })).toBeNull();
    });

    it('refuses steps over 64 KiB serialized', async () => {
      const steps = [
        { id: 's1', instruction: 'x'.repeat(70 * 1024), sortOrder: 0 },
      ];
      expect(await firstError({ ...base(), steps })).toBeTruthy();
    });

    it('measures UTF-8 bytes, not UTF-16 code units', async () => {
      // Every character here is 3 bytes, so 30k of them is ~90 KiB — over the
      // bound — while `String.length` would read 30k and let it through, which
      // is exactly the accented and non-Latin recipes the server refuses.
      const steps = [
        { id: 's1', instruction: '日'.repeat(30_000), sortOrder: 0 },
      ];
      expect(await firstError({ ...base(), steps })).toBeTruthy();
    });
  });
});
