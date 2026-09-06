export interface NamedAvatarIdentity {
  name?: string | null;
  displayName?: string | null;
  id?: string | null;
  userId?: string | null;
}

/** One fallback seed for every rendering of the same member when no avatarUrl is stored. */
export function avatarSeedFor(identity: NamedAvatarIdentity | null | undefined, fallback = "?"): string {
  return identity?.name?.trim()
    || identity?.displayName?.trim()
    || identity?.id
    || identity?.userId
    || fallback;
}
