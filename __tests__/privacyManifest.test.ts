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
  // Error reports. Carries a device and session id, never an account id.
  NSPrivacyCollectedDataTypeCrashData: { linked: false },
  // Startup and render timings, same device-scoped identifiers.
  NSPrivacyCollectedDataTypePerformanceData: { linked: false },
} as const;

/** Values of every `<string>` inside the dict that follows `key`. */
function stringsInSection(xml: string, key: string): string[] {
  const start = xml.indexOf(`<key>${key}</key>`);
  if (start === -1) return [];
  const arrayStart = xml.indexOf('<array', start);
  if (arrayStart === -1) return [];
  if (xml.startsWith('<array/>', arrayStart)) return [];
  const arrayEnd = xml.indexOf('</array>', arrayStart);
  const body = xml.slice(arrayStart, arrayEnd);
  return [...body.matchAll(/<string>([^<]+)<\/string>/g)].map(m => m[1]);
}

describe('iOS privacy manifest', () => {
  const xml = readFileSync(MANIFEST_PATH, 'utf8');

  it('declares every collected data type on the recorded list', () => {
    const declared = [
      ...xml.matchAll(
        /<key>NSPrivacyCollectedDataType<\/key>\s*<string>([^<]+)<\/string>/g,
      ),
    ].map(m => m[1]);

    expect(declared.sort()).toEqual(Object.keys(COLLECTED).sort());
  });

  it('declares no collection the recorded list does not explain', () => {
    const declared = new Set(
      [
        ...xml.matchAll(
          /<key>NSPrivacyCollectedDataType<\/key>\s*<string>([^<]+)<\/string>/g,
        ),
      ].map(m => m[1]),
    );

    for (const type of declared) {
      expect(Object.keys(COLLECTED)).toContain(type);
    }
  });

  it('marks each type linked or unlinked as recorded', () => {
    for (const [type, { linked }] of Object.entries(COLLECTED)) {
      const entryStart = xml.indexOf(`<string>${type}</string>`);
      expect(entryStart).toBeGreaterThan(-1);
      const entry = xml.slice(entryStart, entryStart + 400);
      const linkedTag = entry.match(
        /<key>NSPrivacyCollectedDataTypeLinked<\/key>\s*<(true|false)\/>/,
      );
      expect(linkedTag?.[1]).toBe(linked ? 'true' : 'false');
    }
  });

  it('gives every collected type at least one purpose', () => {
    const purposeBlocks = [
      ...xml.matchAll(
        /<key>NSPrivacyCollectedDataTypePurposes<\/key>\s*<array>([\s\S]*?)<\/array>/g,
      ),
    ];

    expect(purposeBlocks).toHaveLength(Object.keys(COLLECTED).length);
    for (const [, body] of purposeBlocks) {
      expect(body).toMatch(/<string>NSPrivacyCollectedDataTypePurpose/);
    }
  });

  it('claims no tracking, consistent with the per-type flags', () => {
    expect(xml).toMatch(/<key>NSPrivacyTracking<\/key>\s*<false\/>/);
    expect(stringsInSection(xml, 'NSPrivacyTrackingDomains')).toEqual([]);
    expect(xml).not.toMatch(
      /<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*<true\/>/,
    );
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
