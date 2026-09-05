import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, Maximize2, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Avatar, resolveAvatar } from "../Avatar.tsx";
import { useStore } from "../store.tsx";
import {
  buildMemberGraph,
  connectedMemberKeys,
  layoutMemberGraph,
  memberNodeKey,
  summarizeChannels,
  type CollaborationGraphData,
  type MemberGraphNode,
} from "../lib/collaborationGraph.ts";

const EMPTY: CollaborationGraphData = { humans: [], agents: [], channels: [], memberships: [], interactions: [] };
const GRAPH_WIDTH = 1040;
const GRAPH_HEIGHT = 640;

export function CollaborationGraph() {
  const { t } = useTranslation();
  const { api, slug, attachmentUrl } = useStore();
  const navigate = useNavigate();
  const [data, setData] = useState<CollaborationGraphData | null>(null);
  const [failed, setFailed] = useState(false);
  const [focused, setFocused] = useState<MemberGraphNode | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);

  const load = async () => {
    setFailed(false);
    try {
      const result = await api("GET", "/api/channels/collaboration-graph");
      if (!Array.isArray(result?.humans) || !Array.isArray(result?.agents) || !Array.isArray(result?.channels) || !Array.isArray(result?.memberships) || !Array.isArray(result?.interactions)) throw new Error("invalid graph response");
      setData(result);
    } catch {
      setData(EMPTY);
      setFailed(true);
    }
  };
  useEffect(() => { void load(); }, []);

  const graph = useMemo(() => buildMemberGraph(data ?? EMPTY), [data]);
  const positioned = useMemo(() => layoutMemberGraph(graph.nodes, graph.edges, GRAPH_WIDTH, GRAPH_HEIGHT), [graph]);
  const positions = useMemo(() => new Map(positioned.map((node) => [memberNodeKey(node), node])), [positioned]);
  const connected = useMemo(() => focused ? connectedMemberKeys(focused, graph.edges) : null, [focused, graph.edges]);
  const mostConnected = useMemo(() => [...graph.nodes].sort((a, b) => b.connections - a.connections || (a.displayName || a.name).localeCompare(b.displayName || b.name)).slice(0, 6), [graph.nodes]);
  const largestChannels = useMemo(() => summarizeChannels(data ?? EMPTY), [data]);

  const openMember = (node: MemberGraphNode) => navigate(node.type === "agent" ? `/s/${slug}/agent/${node.id}` : `/s/${slug}/human/${node.id}`);
  const setScale = (next: number) => setViewport((current) => ({ ...current, scale: Math.max(0.65, Math.min(1.8, next)) }));
  const resetViewport = () => setViewport({ x: 0, y: 0, scale: 1 });

  return (
    <div className="collab-wrap">
      <div className="collab-toolbar">
        <div className="collab-connection-total"><span />{t("members.graphConnections")} <b>{graph.nodes.length}</b></div>
        <div className="collab-toolbar-actions">
          <button title={t("members.graphZoomOut")} aria-label={t("members.graphZoomOut")} onClick={() => setScale(viewport.scale - 0.15)}><ZoomOut size={15} /></button>
          <button title={t("members.graphResetView")} aria-label={t("members.graphResetView")} onClick={resetViewport}><Maximize2 size={14} /></button>
          <button title={t("members.graphZoomIn")} aria-label={t("members.graphZoomIn")} onClick={() => setScale(viewport.scale + 0.15)}><ZoomIn size={15} /></button>
          <button className="collab-refresh" onClick={load}><RefreshCw size={14} />{t("members.graphRefresh")}</button>
        </div>
      </div>
      {!data ? <div className="empty">{t("members.loading")}</div> : failed ? <div className="empty">{t("members.graphLoadFailed")} <button className="joinbtn" onClick={load}>{t("members.graphRetry")}</button></div> : graph.nodes.length === 0 ? <div className="empty">{t("members.graphEmpty")}</div> : (
        <div className="collab-body">
          <div
            className={`collab-canvas${drag.current ? " dragging" : ""}`}
            onWheel={(event) => { event.preventDefault(); setScale(viewport.scale + (event.deltaY < 0 ? 0.1 : -0.1)); }}
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest("button")) return;
              drag.current = { x: event.clientX, y: event.clientY, originX: viewport.x, originY: viewport.y };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              setViewport((current) => ({ ...current, x: drag.current!.originX + event.clientX - drag.current!.x, y: drag.current!.originY + event.clientY - drag.current!.y }));
            }}
            onPointerUp={(event) => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
            onPointerCancel={() => { drag.current = null; }}
          >
            <div className="collab-stage" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}>
              <svg viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} preserveAspectRatio="none" aria-label={t("members.graphAriaLabel")}>
                {graph.edges.map((edge) => {
                  const source = positions.get(edge.sourceKey);
                  const target = positions.get(edge.targetKey);
                  if (!source || !target) return null;
                  const active = !focused || edge.sourceKey === memberNodeKey(focused) || edge.targetKey === memberNodeKey(focused);
                  return <line key={`${edge.sourceKey}:${edge.targetKey}`} className={active ? "active" : "dim"} x1={source.x} y1={source.y} x2={target.x} y2={target.y} style={{ strokeWidth: Math.min(2.2, 0.65 + Math.log2(edge.weight + 1) * 0.32) }}><title>{t("members.graphInteractionCount", { count: edge.weight })}</title></line>;
                })}
              </svg>
              {positioned.map((node) => {
                const key = memberNodeKey(node);
                const isFocused = focused && memberNodeKey(focused) === key;
                const isDim = !!connected && !connected.has(key);
                return <button
                  key={key}
                  className={`collab-node ${node.type}${isFocused ? " focused" : ""}${isDim ? " dim" : ""}`}
                  style={{ left: `${node.x / GRAPH_WIDTH * 100}%`, top: `${node.y / GRAPH_HEIGHT * 100}%` }}
                  onMouseEnter={() => setFocused(node)} onMouseLeave={() => setFocused(null)} onFocus={() => setFocused(node)} onBlur={() => setFocused(null)}
                  onClick={() => openMember(node)} title={`${node.displayName || node.name} · ${t("members.graphConnectionCount", { count: node.connections })}`}
                >
                  <span className="collab-node-avatar"><Avatar seed={node.name} url={resolveAvatar(node.avatarUrl, attachmentUrl)} size={38} /></span>
                  <span className="collab-node-name">{node.displayName || node.name}</span>
                  {node.type === "agent" && <span className={`dot ${node.status || "inactive"}`} />}
                </button>;
              })}
            </div>
          </div>
          <aside className="collab-insights">
            <div className="collab-stats">
              <span><b>{data.humans.length}</b><small>{t("common.humans")}</small></span>
              <span><b>{data.agents.length}</b><small>{t("common.agents")}</small></span>
              <span><b>{graph.edges.length}</b><small>{t("members.graphLinks")}</small></span>
            </div>
            <section className="collab-ranking">
              <h3>{t("members.graphMostConnected")}</h3>
              {mostConnected.map((node, index) => <button key={memberNodeKey(node)} onClick={() => openMember(node)}>
                <span>{index + 1}</span><Avatar seed={node.name} url={resolveAvatar(node.avatarUrl, attachmentUrl)} size={20} /><b>{node.displayName || node.name}</b><em>{node.connections}</em>
              </button>)}
            </section>
            <section className="collab-ranking collab-channels">
              <h3>{t("members.graphLargestChannels")}</h3>
              {largestChannels.map((channel) => <button key={channel.id} onClick={() => navigate(`/s/${slug}/channel/${channel.id}`)}>
                <Hash size={14} /><b>{channel.name}</b><em>{channel.humanCount}H/{channel.agentCount}A</em>
              </button>)}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
