import type {
  UpdateSettingsInput,
  UserSettings,
} from '#/graphql/generated/schemaTypes';

/**
 * Every account setting the app writes, by the `updateSettings` input group
 * that carries it. A new setting is a line here, selected in `GetUserSettings`
 * (`serverSettingsAreSelected.test.ts`).
 */
const SETTING_GROUPS = {
  theme: 'ui',
  compactMode: 'ui',
  showTutorials: 'ui',
  autoSync: 'sync',
  offlineMode: 'sync',
  preferredUnitSystem: 'regional',
  storeMode: 'shopping',
  budgetAndPrices: 'shopping',
} satisfies Partial<Record<keyof UserSettings, keyof UpdateSettingsInput>>;

export type SettingKey = keyof typeof SETTING_GROUPS;
/** The writable settings, as the server states them. */
export type SettingValues = Pick<UserSettings, SettingKey>;

export const SETTING_KEYS = Object.keys(SETTING_GROUPS).filter(
  (key): key is SettingKey => key in SETTING_GROUPS,
);

/**
 * The settings every host mirrors into its store, so a first paint needs no
 * settings read. Seeded at sign-in (`LoginUser` selects them too) and on each
 * settings read; a sign-out puts back these signed-out values.
 */
export const MIRRORED_SETTING_KEYS = [
  'showTutorials',
  'storeMode',
  'budgetAndPrices',
] satisfies SettingKey[];

export type MirroredSettings = Pick<
  SettingValues,
  (typeof MIRRORED_SETTING_KEYS)[number]
>;

export const MIRRORED_SETTINGS: MirroredSettings = {
  showTutorials: true,
  storeMode: true,
  // Null until the user answers the price prompt or flips the switch.
  budgetAndPrices: null,
};

/** The `updateSettings` input for a change, each setting in its group. */
export function settingsInput(
  updates: Partial<SettingValues>,
): UpdateSettingsInput {
  const input: Partial<
    Record<keyof UpdateSettingsInput, Record<string, unknown>>
  > = {};
  for (const key of SETTING_KEYS) {
    if (!(key in updates)) continue;
    const group = SETTING_GROUPS[key];
    input[group] = { ...input[group], [key]: updates[key] };
  }
  return input;
}

const copyStated = <K extends keyof MirroredSettings>(
  into: Partial<MirroredSettings>,
  from: Partial<MirroredSettings>,
  key: K,
) => {
  if (from[key] !== undefined) into[key] = from[key];
};

/** The mirrored settings a source states, leaving out any it doesn't. */
export function mirroredFrom(
  source: Partial<MirroredSettings> | null | undefined,
): Partial<MirroredSettings> {
  const mirrored: Partial<MirroredSettings> = {};
  if (!source) return mirrored;
  for (const key of MIRRORED_SETTING_KEYS) copyStated(mirrored, source, key);
  return mirrored;
}
