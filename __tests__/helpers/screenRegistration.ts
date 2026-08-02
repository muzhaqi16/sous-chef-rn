/**
 * Shared assertion for the feature screen-registration modules
 * (`features/<name>/screens/registration.ts`).
 *
 * The app passes `linking={{ prefixes }}` with no `enabled`, and
 * react-navigation treats `enabled == null` as `'auto'`
 * (createStaticNavigation.js) — so any leaf screen that doesn't explicitly
 * opt out gets a deep-linkable path generated from its route name. Screens
 * reached by tapping through the UI must therefore declare `linking: null`,
 * and screens that are genuine link targets must declare their path.
 *
 * Either way the intent has to be explicit; the failure mode this guards
 * against is a screen added with no `linking` key at all, which silently
 * becomes deep-linkable.
 */
export function expectDeclaresLinkingIntent(
  group: Record<string, { linking?: unknown }>,
) {
  for (const [name, config] of Object.entries(group)) {
    const declaresIntent =
      config.linking === null ||
      (typeof config.linking === 'string' && config.linking.length > 0);

    // Object form so a failure names the offending screen and its value.
    expect({ screen: name, linking: config.linking, declaresIntent }).toEqual(
      expect.objectContaining({ declaresIntent: true }),
    );
  }
}
