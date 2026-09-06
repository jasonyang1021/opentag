import { useEffect, useRef, useState } from "react";
import { useStore } from "../store.tsx";

export type MentionMember = { type: "user" | "agent"; id: string; name: string; displayName?: string | null };
type Roster = { scope: string; status: "loading" | "ready" | "error"; members: MentionMember[] };

/** Never fall back to the workspace directory when a channel request fails. */
export function useMentionRoster(channelId: string, menuOpen: boolean) {
  const { api, onEvent, serverId } = useStore();
  const scope = `${serverId}:${channelId}`;
  const apiRef = useRef(api);
  apiRef.current = api;
  const [revision, setRevision] = useState(0);
  const [roster, setRoster] = useState<Roster>({ scope: "", status: "loading", members: [] });
  useEffect(() => onEvent(event => {
    if (event.type !== "channel:members-updated") return;
    // Parent-channel changes also invalidate an open thread's roster.
    setRoster({ scope: "", status: "loading", members: [] });
    setRevision(value => value + 1);
  }), [onEvent, scope]);
  useEffect(() => {
    let active = true;
    setRoster({ scope, status: "loading", members: [] });
    if (!channelId || !serverId) return;
    void apiRef.current("GET", `/api/channels/${channelId}/mentionable-members`).then(result => {
      if (!Array.isArray(result?.members)) throw new Error("invalid mention roster");
      if (active) setRoster({ scope, status: "ready", members: result.members });
    }).catch(() => {
      if (active) setRoster({ scope, status: "error", members: [] });
    });
    return () => { active = false; };
  }, [channelId, serverId, scope, revision, menuOpen]);
  return roster.scope === scope ? roster : { scope, status: "loading" as const, members: [] };
}
