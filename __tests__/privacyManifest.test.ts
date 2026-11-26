import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The privacy manifest is read by App Review, not by the app, so nothing at
 * runtime notices when it stops describing what is collected. This pins it to a
 * recorded list: adding a collection without declaring it fails here, and so
 * does declaring one that was removed.
 */
const MANIFEST_PATH = join(
  __dirname,
  '..',
  'ios',
  'SousChef',
  'PrivacyInfo.xcprivacy',
);

/**
 * What the app collects, and why each is on the list. Update this together with
 * the manifest — never the manifest alone.
 */
const COLLECTED = {
  // Account identity: registration, sign-in, household invitations.
  NSPrivacyCollectedDataTypeEmailAddress: { linked: true },
  // Profile display name, shown to other household members.
  NSPrivacyCollectedDataTypeName: { linked: true },
  // Item and profile photos uploaded by the person.
  NSPrivacyCollectedDataTypePhotosorVideos: { linked: true },
  // A scanned receipt: its redacted lines are matched to items, and its day,
  // store and prices are recorded with what it adds to the pantry.
  NSPrivacyCollectedDataTypePurchaseHistory: { linked: true },
  // Error reports. Carries a device and session id, never an account id.
  NSPrivacyCollectedDataTypeCrashData: { linked: false },
  // Startup and render timings, same device-scoped identifiers.
  NSPrivacyCollectedDataTypePerformanceData: { linked: false },
} as const;

/**
 * The value element that directly follows `<key>key</key>`, or undefined. An
 * array or dict is read to its own closing tag, past any nested in it.
 */
function valueAfter(xml: string, key: string): string | undefined {
  const marker = `<key>${key}</key>`;
  const at = xml.indexOf(marker);
  if (at === -1) return undefined;
  const body = xml.slice(at + marker.length).trimStart();
  const leaf =
    /^(<array\/>|<dict\/>|<true\/>|<false\/>|<string>[^<]*<\/string>)/.exec(
      body,
    );
  if (leaf) return leaf[1];
  const [, tag] = /^<(array|dict)>/.exec(body) ?? [];
  if (!tag) return undefined;
  const nesting = new RegExp(`<(/?)${tag}>`, 'g');
  let depth = 0;
  for (const match of body.matchAll(nesting)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return body.slice(0, (match.index ?? 0) + match[0].length);
  }
  return undefined;
}

/** The `<string>` values of an array value, or none. */
const stringsOf = (value: string | undefined): string[] =>
  [...(value ?? '').matchAll(/<string>([^<]+)<\/string>/g)].map(m => m[1]!);

/** The flag a key holds: true, false, or undefined when it holds no flag. */
const flagOf = (xml: string, key: string): boolean | undefined => {
  const value = valueAfter(xml, key);
  return value === '<true/>' ? true : value === '<false/>' ? false : undefined;
};

/** Each collected-type entry: its own dict, read on its own. */
const collectedEntries = (xml: string) =>
  [
    ...(valueAfter(xml, 'NSPrivacyCollectedDataTypes') ?? '').matchAll(
      /<dict>([\s\S]*?)<\/dict>/g,
    ),
  ].map(([, entry = '']) => ({
    type: stringsOf(valueAfter(entry, 'NSPrivacyCollectedDataType')).at(0),
    linked: flagOf(entry, 'NSPrivacyCollectedDataTypeLinked'),
    tracking: flagOf(entry, 'NSPrivacyCollectedDataTypeTracking'),
    purposes: stringsOf(
      valueAfter(entry, 'NSPrivacyCollectedDataTypePurposes'),
    ),
  }));

describe('iOS privacy manifest', () => {
  const xml = readFileSync(MANIFEST_PATH, 'utf8');
  const entries = collectedEntries(xml);

  it('reads each entry on its own, never from its neighbour', () => {
    const planted = `
      <key>NSPrivacyTracking</key><false/>
      <key>NSPrivacyCollectedDataTypes</key>
      <array>
        <dict>
          <key>NSPrivacyCollectedDataType</key><string>A</string>
        </dict>
        <dict>
          <key>NSPrivacyCollectedDataType</key><string>B</string>
          <key>NSPrivacyCollectedDataTypeLinked</key><true/>
        </dict>
      </array>`;

    expect(collectedEntries(planted).map(entry => entry.linked)).toEqual([
      undefined,
      true,
    ]);
    expect(stringsOf(valueAfter(planted, 'NSPrivacyTracking'))).toEqual([]);
  });

  it('declares exactly the collected data types on the recorded list', () => {
    expect(entries.map(entry => entry.type).sort()).toEqual(
      Object.keys(COLLECTED).sort(),
    );
  });

  it('marks each type linked or unlinked as recorded', () => {
    for (const [type, { linked }] of Object.entries(COLLECTED)) {
      expect(entries.find(entry => entry.type === type)?.linked).toBe(linked);
    }
  });

  it('gives every collected type at least one purpose', () => {
    for (const entry of entries) {
      expect(
        entry.purposes.some(purpose =>
          purpose.startsWith('NSPrivacyCollectedDataTypePurpose'),
        ),
      ).toBe(true);
    }
  });

  it('claims no tracking, consistent with the per-type flags', () => {
    expect(flagOf(xml, 'NSPrivacyTracking')).toBe(false);
    expect(stringsOf(valueAfter(xml, 'NSPrivacyTrackingDomains'))).toEqual([]);
    expect(entries.filter(entry => entry.tracking === true)).toEqual([]);
  });

  it('keeps the required-reason API declarations', () => {
    const apiTypes = [
      ...xml.matchAll(
        /<key>NSPrivacyAccessedAPIType<\/key>\s*<string>([^<]+)<\/string>/g,
      ),
    ].map(m => m[1]);

    expect(apiTypes).toEqual(
      expect.arrayContaining([
        'NSPrivacyAccessedAPICategorySystemBootTime',
        'NSPrivacyAccessedAPICategoryUserDefaults',
        'NSPrivacyAccessedAPICategoryFileTimestamp',
        'NSPrivacyAccessedAPICategoryDiskSpace',
      ]),
    );
  });
});
