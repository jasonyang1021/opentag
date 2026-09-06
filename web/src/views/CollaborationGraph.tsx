import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, GitBranch, Hash, Maximize2, RefreshCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Avatar, resolveAvatar } from "../Avatar.tsx";
import { useStore } from "../store.tsx";
import { buildMemberGraph, connectedMemberKeys, edgeCurveOffsets, layoutMemberGraph,
  memberNodeKey, summarizeChannels, totalInteractionCount, type CollaborationGraphData, type MemberGraphNode } from "../lib/collaborationGraph.ts";
import "./collaborationGraph.css";

const EMPTY: CollaborationGraphData = { humans: [], agents: [], channels: [], memberships: [], interactions: [] };
const displayName = (node: MemberGraphNode) => node.displayName || node.name;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const pairKey = (source: string, target: string) => source + "|" + target;
type Point = { x: number; y: number };

export function CollaborationGraph() {
  const { t } = useTranslation();
  const { api, slug, serverId, attachmentUrl } = useStore();
  const navigate = useNavigate();
  const [data, setData] = useState<CollaborationGraphData | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const apiRef = useRef(api);
  apiRef.current = api;
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [manual, setManual] = useState<Record<string, Point>>({});
  const [size, setSize] = useState({ width: 900, height: 640 });
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key?: string; start: Point; origin: Point; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setFailed(false);
    try {
      const result = await apiRef.current("GET", "/api/channels/collaboration-graph");
      if (!["humans", "agents", "channels", "memberships", "interactions"].every((key) => Array.isArray(result?.[key]))) throw new Error("invalid graph");
      if (id === request.current) setData(result);
    } catch { if (id === request.current) setFailed(true); }
    finally { if (id === request.current) setLoading(false); }
  }, []);
  useEffect(() => {
    setData(null); setSelected(null); setSelectedEdge(null); setHovered(null); setManual({});
    void load();
    return () => { request.current++; };
  }, [serverId, load]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: Math.max(280, entry.contentRect.width), height: entry.contentRect.height });
      const fit = Math.min(1, entry.contentRect.width / 640);
      setManual({}); setViewport({ x: 0, y: (entry.contentRect.height - Math.max(520, entry.contentRect.height) * fit) / 2, scale: fit });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const graph = useMemo(() => buildMemberGraph(data ?? EMPTY), [data]);
  const width = Math.max(640, size.width), height = Math.max(520, size.height);
  const layout = useMemo(() => layoutMemberGraph(graph.nodes, graph.edges, width, height), [graph, width, height]);
  const positions = useMemo(() => new Map(layout.map((node) => [memberNodeKey(node), { ...node, ...manual[memberNodeKey(node)] }])), [layout, manual]);
  const edgeLabels = useMemo(() => {
    const labels = new Map<string, Point>();
    for (const item of graph.edges) {
      const a = positions.get(item.sourceKey)!, b = positions.get(item.targetKey)!;
      const key = pairKey(item.sourceKey, item.targetKey);
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1;
      const direction = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2 ? 1 : -1;
      const offsets = edgeCurveOffsets(item.weight, direction, distance);
      const offset = offsets[Math.floor(offsets.length / 2)]!;
      const control = { x: (a.x + b.x) / 2 - dy / distance * offset, y: (a.y + b.y) / 2 + dx / distance * offset };
      const candidates = [0.64, 0.36, 0.78, 0.22, 0.5].map((fraction) => ({
        x: (1 - fraction) ** 2 * a.x + 2 * (1 - fraction) * fraction * control.x + fraction ** 2 * b.x,
        y: (1 - fraction) ** 2 * a.y + 2 * (1 - fraction) * fraction * control.y + fraction ** 2 * b.y,
      }));
      const penalty = (point: Point) =>
        [...labels.values()].reduce((sum, p) => sum + (Math.abs(p.x - point.x) < 42 && Math.abs(p.y - point.y) < 28 ? 10 : 0), 0) +
        [...positions.values()].reduce((sum, p) => sum + (Math.abs(p.x - point.x) < 65 && point.y > p.y - 32 && point.y < p.y + 60 ? 5 : 0), 0);
      candidates.sort((a, b) => penalty(a) - penalty(b));
      labels.set(key, candidates[0]!);
    }
    return labels;
  }, [graph.edges, positions]);
  const selectedNode = graph.nodes.find((node) => memberNodeKey(node) === selected);
  const edge = graph.edges.find((item) => pairKey(item.sourceKey, item.targetKey) === selectedEdge);
  const focus = selectedNode ?? graph.nodes.find((node) => memberNodeKey(node) === hovered);
  const connected = useMemo(() => focus ? connectedMemberKeys(focus, graph.edges) : edge ? new Set([edge.sourceKey, edge.targetKey]) : null, [focus, edge, graph.edges]);
  const ranked = useMemo(() => [...graph.nodes].filter((node) => node.connections > 0).sort((a, b) => b.connections - a.connections || displayName(a).localeCompare(displayName(b))), [graph.nodes]);
  const collaborators = useMemo(() => !selectedNode ? [] : graph.edges.flatMap((item) => {
    const own = memberNodeKey(selectedNode);
    const other = item.sourceKey === own ? item.targetKey : item.targetKey === own ? item.sourceKey : null;
    const node = other ? positions.get(other) : null;
    return node ? [{ node, weight: item.weight }] : [];
  }).sort((a, b) => b.weight - a.weight), [selectedNode, graph.edges, positions]);
  const channels = useMemo(() => summarizeChannels(data ?? EMPTY), [data]);
  const totals = totalInteractionCount(graph.edges);
  const clearFocus = () => { setSelected(null); setSelectedEdge(null); setHovered(null); };
  const selectNode = (key: string) => { setSelected(key); setSelectedEdge(null); setHovered(null); };
  const reset = () => { const scale = Math.min(1, size.width / width); setViewport({ x: 0, y: (size.height - height * scale) / 2, scale }); setManual({}); clearFocus(); };
  const openMember = (node: MemberGraphNode) => navigate(`/s/${slug}/${node.type === "agent" ? "agent" : "human"}/${node.id}`);
  const zoom = (delta: number, point?: Point) => setViewport((v) => {
    const scale = clamp(v.scale + delta, 0.5, 2.5);
    const p = point ?? { x: size.width / 2, y: size.height / 2 };
    return { scale, x: p.x - (p.x - v.x) * scale / v.scale, y: p.y - (p.y - v.y) * scale / v.scale };
  });
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoom(event.deltaY < 0 ? 0.08 : -0.08, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [size.width, size.height]);
  useEffect(() => {
    if (selected && !graph.nodes.some((node) => memberNodeKey(node) === selected)) setSelected(null);
    if (selectedEdge && !graph.edges.some((item) => pairKey(item.sourceKey, item.targetKey) === selectedEdge)) setSelectedEdge(null);
  }, [graph, selected, selectedEdge]);
  const avatar = (node: MemberGraphNode, px = 38) => <Avatar kind={node.type} seed={node.name} url={resolveAvatar(node.avatarUrl, attachmentUrl)} size={px} />;

  return <div className={`gx${expanded ? " gx-expanded" : ""}`} onKeyDown={(event) => {
    if (event.key === "Escape") { clearFocus(); setExpanded(false); }
  }}>
    <div className="gx-heading">
      <p>{t("graphExplorer.subtitle")}</p>
      <button className="gx-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "gx-spin" : ""} />{t("members.graphRefresh")}</button>
    </div>
    {failed && <div className="gx-error" role="alert">{t("members.graphLoadFailed")} {data && t("graphExplorer.stale")} <button onClick={() => void load()}>{t("members.graphRetry")}</button></div>}
    <div className="gx-body">
      <div className="gx-map" ref={canvas}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const target = event.target as Element;
          const node = target.closest<HTMLElement>("[data-node]");
          if (target.closest("[data-controls], [data-edge]")) return;
          const key = node?.dataset.node;
          const position = key ? positions.get(key) : null;
          drag.current = { key, start: { x: event.clientX, y: event.clientY }, origin: position ?? { x: viewport.x, y: viewport.y }, moved: false };
          suppressClick.current = false;
          if (!key) event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (!current) return;
          const dx = event.clientX - current.start.x, dy = event.clientY - current.start.y;
          if (Math.hypot(dx, dy) < 4 && !current.moved) return;
          current.moved = true; suppressClick.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          if (current.key) {
            const key = current.key;
            setManual((old) => ({ ...old, [key]: { x: clamp(current.origin.x + dx / viewport.scale, 50, width - 50), y: clamp(current.origin.y + dy / viewport.scale, 40, height - 60) } }));
          } else setViewport((v) => ({ ...v, x: current.origin.x + dx, y: current.origin.y + dy }));
        }}
        onPointerUp={(event) => {
          if (drag.current && !drag.current.key && !drag.current.moved) clearFocus();
          drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { drag.current = null; suppressClick.current = true; }}
      >
        <div className="gx-map-caption" data-controls><span className="gx-live-dot" />{t("graphExplorer.visible", { count: graph.nodes.length })}<span>·</span>{t("graphExplorer.relationshipCount", { count: graph.edges.length })}</div>
        <div className="gx-stage" style={{ width, height, transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})` }}>
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label={t("members.graphAriaLabel")}>
            {graph.edges.map((item) => {
              const a = positions.get(item.sourceKey)!, b = positions.get(item.targetKey)!;
              const key = pairKey(item.sourceKey, item.targetKey);
              const active = focus ? item.sourceKey === memberNodeKey(focus) || item.targetKey === memberNodeKey(focus) : selectedEdge === key;
              const dim = !!connected && !active;
              const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1;
              const direction = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2 ? 1 : -1;
              const offsets = edgeCurveOffsets(item.weight, direction, distance);
              const path = (offset: number) => `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2 - dy / distance * offset} ${(a.y + b.y) / 2 + dx / distance * offset} ${b.x} ${b.y}`;
              const middle = offsets[Math.floor(offsets.length / 2)]!;
              const labelPosition = edgeLabels.get(key)!;
              const label = `${displayName(a)} ↔ ${displayName(b)} · ${t("members.graphInteractionCount", { count: item.weight })}`;
              return <g key={key} className={`gx-edge${active ? " active" : ""}${dim ? " dim" : ""}`}>
                {offsets.map((offset, index) => <path className="gx-strand" key={index} d={path(offset)} />)}
                <path className="gx-edge-hit" data-edge={key} d={path(middle)} role="button" tabIndex={0} aria-label={label} onClick={() => { clearFocus(); setSelectedEdge(key); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clearFocus(); setSelectedEdge(key); } }}><title>{label}</title></path>
                {active && <g className="gx-edge-count" transform={`translate(${labelPosition.x},${labelPosition.y})`}><rect x={-17} y={-11} width={34} height={22} rx={11} /><text textAnchor="middle" dy="4">{item.weight}</text></g>}
              </g>;
            })}
          </svg>
          {[...positions.values()].map((node) => {
            const key = memberNodeKey(node), dim = !!connected && !connected.has(key);
            return <button key={key} data-node={key} aria-pressed={selected === key}
              className={`gx-node ${node.type}${node.connections ? "" : " isolated"}${dim ? " dim" : ""}${selected === key ? " selected" : ""}`}
              style={{ left: node.x, top: node.y }}
              onDragStart={(event) => event.preventDefault()}
              onMouseEnter={() => setHovered(key)} onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(key)} onBlur={() => setHovered(null)}
              onClick={(event) => { if (event.detail === 0 || !suppressClick.current) selectNode(key); }}
              title={`${displayName(node)} · ${t("members.graphInteractionCount", { count: node.connections })}`}>
              <span className="gx-avatar">{avatar(node)}{node.type === "agent" && <span className={`dot ${node.status || "inactive"}`} />}</span>
              <span className="gx-node-name">{displayName(node)}</span>
            </button>;
          })}
        </div>
        {!data && !failed && <div className="gx-map-empty" role="status">{t("members.loading")}</div>}
        {data && !graph.nodes.length && <div className="gx-map-empty" role="status"><GitBranch size={30} /><b>{t("graphExplorer.noResults")}</b></div>}
        <div className="gx-map-bottom" data-controls>
          <div className="gx-legend"><span><i className="human" />{t("common.humans")}</span><span><i className="agent" />{t("common.agents")}</span></div>
          <div className="gx-map-tools">
            <button aria-label={t("members.graphZoomOut")} title={t("members.graphZoomOut")} onClick={() => zoom(-0.15)}><ZoomOut size={16} /></button><span>{Math.round(viewport.scale * 100)}%</span>
            <button aria-label={t("members.graphZoomIn")} title={t("members.graphZoomIn")} onClick={() => zoom(0.15)}><ZoomIn size={16} /></button>
            <button aria-label={t("members.graphResetView")} title={t("members.graphResetView")} onClick={reset}><RefreshCw size={15} /></button>
            <button aria-label={t(expanded ? "graphExplorer.collapse" : "graphExplorer.expand")} title={t(expanded ? "graphExplorer.collapse" : "graphExplorer.expand")} onClick={() => setExpanded(!expanded)}>{expanded ? <X size={16} /> : <Maximize2 size={16} />}</button>
          </div>
        </div>
      </div>
      <aside className="gx-insights">
        <div className="gx-stats"><div><b>{graph.nodes.length}</b><span>{t("graphExplorer.members")}</span></div><div><b>{graph.edges.length}</b><span>{t("graphExplorer.relationships")}</span></div><div><b>{totals}</b><span>{t("graphExplorer.interactions")}</span></div></div>
        {selectedNode ? <section className="gx-card gx-detail">
          <div className="gx-card-heading"><h3>{t("graphExplorer.memberDetail")}</h3><button aria-label={t("graphExplorer.closeDetail")} onClick={clearFocus}><X size={16} /></button></div>
          <div className="gx-person">{avatar(selectedNode, 46)}<div><h4>{displayName(selectedNode)}</h4><span>{t("graphExplorer." + selectedNode.type)}</span></div></div>
          <p>{t("graphExplorer.memberSummary", { count: collaborators.length, interactions: selectedNode.connections })}</p>
          <button className="gx-button gx-profile" onClick={() => openMember(selectedNode)}>{t("graphExplorer.profile")}<ArrowUpRight size={14} /></button>
          <h3>{t("graphExplorer.collaborators")}</h3>
          {!collaborators.length && <p>{t("graphExplorer.noInteractions")}</p>}
          <div className="gx-list">{collaborators.map(({ node, weight }) => <button key={memberNodeKey(node)} onClick={() => selectNode(memberNodeKey(node))}>{avatar(node, 24)}<span>{displayName(node)}</span><b title={t("graphExplorer.interactions")}>{weight}</b></button>)}</div>
        </section> : edge ? <section className="gx-card gx-detail">
          <div className="gx-card-heading"><h3>{t("graphExplorer.relationshipDetail")}</h3><button aria-label={t("graphExplorer.closeDetail")} onClick={clearFocus}><X size={16} /></button></div>
          {[edge.sourceKey, edge.targetKey].map((key) => { const node = positions.get(key)!; return <button key={key} className="gx-person gx-person-button" onClick={() => selectNode(key)}>{avatar(node, 42)}<h4>{displayName(node)}</h4><ArrowUpRight size={14} /></button>; })}
          <div className="gx-interaction-total"><b>{edge.weight}</b><span>{t("graphExplorer.interactions")}</span></div><p>{t("graphExplorer.evidence")}</p>
        </section> : <section className="gx-card">
          <div className="gx-card-heading"><h3>{t("graphExplorer.topCollaborators")}</h3><GitBranch size={15} /></div>
          <p>{t("graphExplorer.rankingHint")}</p>
          <div className="gx-list">{ranked.slice(0, 6).map((node, index) => <button key={memberNodeKey(node)} onClick={() => selectNode(memberNodeKey(node))}><small>{String(index + 1).padStart(2, "0")}</small>{avatar(node, 24)}<span>{displayName(node)}</span><b>{node.connections}</b></button>)}</div>
          {!ranked.length && <p>{t("graphExplorer.noInteractions")}</p>}
        </section>}
        <p className="gx-note">{t("graphExplorer.source")}</p>
        <section className="gx-card gx-channel-card"><h3>{t("members.graphLargestChannels")}</h3><div className="gx-list">{channels.map((channel) => <button key={channel.id} onClick={() => navigate(`/s/${slug}/channel/${channel.id}`)}><Hash size={14} /><span>{channel.name}</span><small>{channel.humanCount}H / {channel.agentCount}A</small><ArrowUpRight size={13} /></button>)}</div></section>
      </aside>
    </div>
  </div>;
}
