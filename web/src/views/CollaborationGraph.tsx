import { useEffect, useMemo, useState } from "react";
import { Bot, Hash, Search, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Avatar, resolveAvatar } from "../Avatar.tsx";
import { useStore } from "../store.tsx";
import {
  connectedNodeKeys,
  layoutCollaborationGraph,
  type CollaborationGraphData,
  type CollaborationNode,
  type CollaborationNodeType,
} from "../lib/collaborationGraph.ts";

const EMPTY: CollaborationGraphData = { humans: [], agents: [], channels: [], memberships: [] };
const nodeKey = (node: CollaborationNode) => `${node.type}:${node.id}`;

export function CollaborationGraph() {
  const { t } = useTranslation();
  const { api, slug, attachmentUrl } = useStore();
  const navigate = useNavigate();
  const [data, setData] = useState<CollaborationGraphData | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState<Set<CollaborationNodeType>>(new Set(["human", "channel", "agent"]));
  const [focused, setFocused] = useState<CollaborationNode | null>(null);

  const load = async () => {
    setFailed(false);
    try {
      const result = await api("GET", "/api/channels/collaboration-graph");
      if (!Array.isArray(result?.humans) || !Array.isArray(result?.agents) || !Array.isArray(result?.channels) || !Array.isArray(result?.memberships)) throw new Error("invalid graph response");
      setData(result);
    } catch {
      setData(EMPTY);
      setFailed(true);
    }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const source = data ?? EMPTY;
    const q = query.trim().toLocaleLowerCase();
    if (!q) return source;
    const matches = (node: CollaborationNode) => `${node.displayName || ""} ${node.name}`.toLocaleLowerCase().includes(q);
    const humans = source.humans.filter(matches);
    const agents = source.agents.filter(matches);
    const directChannels = source.channels.filter(matches);
    const memberKeys = new Set([...humans, ...agents].map(nodeKey));
    const relatedChannelIds = new Set(source.memberships.filter((membership) => memberKeys.has(`${membership.memberType}:${membership.memberId}`)).map((membership) => membership.channelId));
    const channels = source.channels.filter((channel) => directChannels.some((match) => match.id === channel.id) || relatedChannelIds.has(channel.id));
    const channelIds = new Set(channels.map((channel) => channel.id));
    const directlyMatchedChannelIds = new Set(directChannels.map((channel) => channel.id));
    const channelMemberKeys = new Set(source.memberships.filter((membership) => directlyMatchedChannelIds.has(membership.channelId)).map((membership) => `${membership.memberType}:${membership.memberId}`));
    return {
      humans: source.humans.filter((human) => humans.some((match) => match.id === human.id) || channelMemberKeys.has(nodeKey(human))),
      agents: source.agents.filter((agent) => agents.some((match) => match.id === agent.id) || channelMemberKeys.has(nodeKey(agent))),
      channels,
      memberships: source.memberships.filter((membership) => channelIds.has(membership.channelId)),
    };
  }, [data, query]);
  const layout = useMemo(() => layoutCollaborationGraph(filtered, visible), [filtered, visible]);
  const positions = useMemo(() => new Map(layout.nodes.map((node) => [nodeKey(node), node])), [layout.nodes]);
  const connected = useMemo(() => focused ? connectedNodeKeys(focused, layout.memberships) : null, [focused, layout.memberships]);
  const toggle = (type: CollaborationNodeType) => setVisible((current) => {
    const next = new Set(current);
    if (next.has(type)) next.delete(type); else next.add(type);
    return next;
  });
  const open = (node: CollaborationNode) => {
    if (node.type === "channel") navigate(`/s/${slug}/channel/${node.id}`);
    else if (node.type === "agent") navigate(`/s/${slug}/agent/${node.id}`);
    else navigate(`/s/${slug}/human/${node.id}`);
  };
  const top = [...layout.nodes].filter((node) => node.type !== "channel").sort((a, b) => b.connections - a.connections).slice(0, 5);

  return (
    <div className="collab-wrap">
      <div className="collab-toolbar">
        <label className="collab-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("members.graphSearch")} /></label>
        <div className="collab-filters" aria-label={t("members.graphFilters")}>{(["human", "agent", "channel"] as const).map((type) => (
          <button key={type} className={visible.has(type) ? "on" : ""} aria-pressed={visible.has(type)} onClick={() => toggle(type)}>
            {type === "human" ? <UserRound size={14} /> : type === "agent" ? <Bot size={14} /> : <Hash size={14} />}{t(`members.graphType.${type}`)}
          </button>
        ))}</div>
        <button className="joinbtn" onClick={load}>{t("members.graphRefresh")}</button>
      </div>
      <div className="collab-stats">
        <span><b>{data?.humans.length ?? 0}</b>{t("common.humans")}</span>
        <span><b>{data?.agents.length ?? 0}</b>{t("common.agents")}</span>
        <span><b>{data?.channels.length ?? 0}</b>{t("members.graphChannels")}</span>
        <span><b>{data?.memberships.length ?? 0}</b>{t("members.graphConnections")}</span>
      </div>
      {!data ? <div className="empty">{t("members.loading")}</div> : failed ? <div className="empty">{t("members.graphLoadFailed")} <button className="joinbtn" onClick={load}>{t("members.graphRetry")}</button></div> : layout.nodes.length === 0 ? <div className="empty">{t("members.graphEmpty")}</div> : (
        <div className="collab-body">
          <div className="collab-canvas" style={{ minHeight: layout.height }}>
            <svg viewBox={`0 0 100 ${layout.height}`} preserveAspectRatio="none" aria-hidden="true">
              {layout.memberships.map((membership) => {
                const member = positions.get(`${membership.memberType}:${membership.memberId}`);
                const channel = positions.get(`channel:${membership.channelId}`);
                if (!member || !channel) return null;
                const edgeActive = !connected || (connected.has(nodeKey(member)) && connected.has(nodeKey(channel)));
                const bend = (member.x + channel.x) / 2;
                return <path key={`${membership.channelId}:${membership.memberType}:${membership.memberId}`} className={edgeActive ? "active" : "dim"} d={`M ${member.x} ${member.y} C ${bend} ${member.y}, ${bend} ${channel.y}, ${channel.x} ${channel.y}`} />;
              })}
            </svg>
            {layout.nodes.map((node) => {
              const isFocused = focused && nodeKey(focused) === nodeKey(node);
              const isDim = !!connected && !connected.has(nodeKey(node));
              return <button key={nodeKey(node)} className={`collab-node ${node.type}${isFocused ? " focused" : ""}${isDim ? " dim" : ""}`} style={{ left: `${node.x}%`, top: node.y }} onMouseEnter={() => setFocused(node)} onMouseLeave={() => setFocused(null)} onFocus={() => setFocused(node)} onBlur={() => setFocused(null)} onClick={() => open(node)} title={`${node.displayName || node.name} · ${t("members.graphConnectionCount", { count: node.connections })}`}>
                {node.type === "channel" ? <span className="collab-channel-icon"><Hash size={14} /></span> : <Avatar seed={node.name} url={resolveAvatar(node.avatarUrl, attachmentUrl)} size={28} />}
                <span className="collab-node-copy"><b>{node.displayName || node.name}</b><small>{node.type === "agent" ? `@${node.name}` : t("members.graphConnectionCount", { count: node.connections })}</small></span>
                {node.type === "agent" && <span className={`dot ${node.status || "inactive"}`} />}
              </button>;
            })}
          </div>
          <aside className="collab-ranking"><h3>{t("members.graphMostConnected")}</h3>{top.map((node, index) => <button key={nodeKey(node)} onClick={() => open(node)}><span>{index + 1}</span><b>{node.displayName || node.name}</b><em>{node.connections}</em></button>)}</aside>
        </div>
      )}
    </div>
  );
}
