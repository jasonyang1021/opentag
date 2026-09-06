export interface NavigationChannel { id: string; name: string; type: string; audit?: boolean }

// An explicit URL must never silently open a different conversation.
export function selectNavigationChannel<T extends NavigationChannel>(
  channelId: string | undefined, channels: T[], resolved: T | null,
): T | undefined {
  if (channelId) return channels.find((c) => c.id === channelId) ?? (resolved?.id === channelId ? resolved : undefined);
  return channels.find((c) => c.name === "all") ?? channels[0];
}

export function matchesThreadParent(target: string, messageId: string): boolean {
  const short = target.split(":").pop()!;
  return !!short && messageId.startsWith(short);
}

export function selectChatTab(params: URLSearchParams, readOnly: boolean): string {
  return readOnly || params.has("thread") || params.has("msg") ? "chat" : params.get("chatTab") || "chat";
}
