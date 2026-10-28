import type { ResolveShareLinkQuery } from '#operations/home/home.generated';
import { ShareLinkTargetType } from '#/graphql/generated/schemaTypes';

export type HomeLinkPreview = NonNullable<
  ResolveShareLinkQuery['resolveShareLink']
>;

/** The home a join code previews; null for a list's share code or no match. */
export function homeLink(
  link: HomeLinkPreview | null | undefined,
): HomeLinkPreview | null {
  return link?.targetType === ShareLinkTargetType.HomeJoin ? link : null;
}
