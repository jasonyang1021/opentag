import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, GitBranch, Hash, Maximize2, RefreshCw, Search, X, ZoomIn, ZoomOut, Sparkles, Orbit, Moon, Sun, Pause, Play, Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Avatar, resolveAvatar } from "../Avatar.tsx";
import { useStore } from "../store.tsx";
import { buildMemberGraph, connectedMemberKeys, edgeCurveOffsets, filterMemberGraph, layoutMemberGraph,
  shortestMemberPath, layoutOrbitGraph, memberNodeKey, summarizeChannels, totalInteractionCount, type CollaborationGraphData, type MemberGraphNode } from "../lib/collaborationGraph.ts";
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
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "human" | "agent">("all");
  const [minimum, setMinimum] = useState(1);
  const [hideIsolated, setHideIsolated] = useState(false);
  const [strands, setStrands] = useState(false);
  const [night, setNight] = useState(true);
  const [motion, setMotion] = useState(false);
  const [orbit, setOrbit] = useState(false);
  const [routeStart, setRouteStart] = useState<string | null>(null);
  const [routeEnd, setRouteEnd] = useState<string | null>(null);
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
    setData(null); setSelected(null); setSelectedEdge(null); setHovered(null); setManual({}); setRouteStart(null); setRouteEnd(null);
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
  const fullGraph = useMemo(() => buildMemberGraph(data ?? EMPTY), [data]);
  const graph = useMemo(() => filterMemberGraph(fullGraph, type, minimum, hideIsolated), [fullGraph, type, minimum, hideIsolated]);
  const width = Math.max(640, size.width), height = Math.max(520, size.height);
  const layout = useMemo(() => orbit ? layoutOrbitGraph(graph.nodes, width, height) : layoutMemberGraph(graph.nodes, graph.edges, width, height), [graph, width, height, orbit]);
  const positions = useMemo(() => new Map(layout.map((node) => [memberNodeKey(node), { ...node, ...manual[memberNodeKey(node)] }])), [layout, manual]);
  const edgeLabels = useMemo(() => {
    const labels = new Map<string, Point>();
    for (const item of graph.edges) {
      const a = positions.get(item.sourceKey)!, b = positions.get(item.targetKey)!;
      const key = pairKey(item.sourceKey, item.targetKey);
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1;
      const direction = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2 ? 1 : -1;
      const offsets = edgeCurveOffsets(strands ? item.weight : 1, direction, distance);
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
  }, [graph.edges, positions, strands]);
  const selectedNode = graph.nodes.find((node) => memberNodeKey(node) === selected);
  const edge = graph.edges.find((item) => pairKey(item.sourceKey, item.targetKey) === selectedEdge);
  const route = useMemo(() => routeStart && routeEnd ? shortestMemberPath(routeStart, routeEnd, graph.edges) : null, [routeStart, routeEnd, graph.edges]);
  const routeEdges = useMemo(() => new Set(route?.slice(1).map((key, i) => [route[i]!, key].sort().join("|")) ?? []), [route]);
  const focus = routeStart ? null : selectedNode ?? graph.nodes.find((node) => memberNodeKey(node) === hovered);
  const connected = useMemo(() => routeStart && routeEnd ? new Set(route ?? [routeStart, routeEnd]) : focus ? connectedMemberKeys(focus, graph.edges) : edge ? new Set([edge.sourceKey, edge.targetKey]) : null, [routeStart, routeEnd, route, focus, edge, graph.edges]);
  const matching = useMemo(() => new Set(graph.nodes.filter((node) => (displayName(node) + " " + node.name).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(memberNodeKey)), [graph.nodes, query]);
  const ranked = useMemo(() => [...graph.nodes].filter((node) => node.connections > 0).sort((a, b) => b.connections - a.connections || displayName(a).localeCompare(displayName(b))), [graph.nodes]);
  const collaborators = useMemo(() => !selectedNode ? [] : graph.edges.flatMap((item) => {
    const own = memberNodeKey(selectedNode);
    const other = item.sourceKey === own ? item.targetKey : item.targetKey === own ? item.sourceKey : null;
    const node = other ? positions.get(other) : null;
    return node ? [{ node, weight: item.weight }] : [];
  }).sort((a, b) => b.weight - a.weight), [selectedNode, graph.edges, positions]);
  const channels = useMemo(() => summarizeChannels(data ?? EMPTY), [data]);
  const totals = totalInteractionCount(graph.edges);
  const clearFocus = () => { setSelected(null); setSelectedEdge(null); setHovered(null); setRouteStart(null); setRouteEnd(null); };
  const selectNode = (key: string) => { if (routeStart) { setRouteEnd(key); setSelected(null); } else setSelected(key); setSelectedEdge(null); setHovered(null); setQuery(""); };
  const reset = () => { const scale = Math.min(1, size.width / width); setViewport({ x: 0, y: (size.height - height * scale) / 2, scale }); setManual({}); clearFocus(); };
  const resetFilters = () => { setQuery(""); setType("all"); setMinimum(1); setHideIsolated(false); clearFocus(); };
  const openMember = (node: MemberGraphNode) => navigate(`/s/${slug}/${node.type === "agent" ? "agent" : "human"}/${node.id}`);
  const zoom = (delta: number, point?: Point) => setViewport((v) => {
    const scale = clamp(v.scale + delta, 0.5, 2.5);
    const p = point ?? { x: size.width / 2, y: size.height / 2 };
    return { scale, x: p.x - (p.x - v.x) * scale / v.scale, y: p.y - (p.y - v.y) * scale / v.scale };
  });
  useEffect(() => {
    if (routeStart && (!graph.nodes.some(node => memberNodeKey(node) === routeStart) || (routeEnd && !graph.nodes.some(node => memberNodeKey(node) === routeEnd)))) { setRouteStart(null); setRouteEnd(null); }
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
  }, [graph, selected, selectedEdge, routeStart, routeEnd]);
  const filtersActive = type !== "all" || minimum !== 1 || hideIsolated || !!query;
  const avatar = (node: MemberGraphNode, px = 38) => <Avatar seed={node.name} url={resolveAvatar(node.avatarUrl, attachmentUrl)} size={px} />;

  return <div className={`gx gx-atlas${night ? " gx-night" : ""}${motion ? " gx-motion" : ""}${expanded ? " gx-expanded" : ""}`} onKeyDown={(event) => {
    if (event.key === "Escape") { clearFocus(); setExpanded(false); }
  }}>
    <div className="gx-heading">
      <div><span className="gx-eyebrow">{t("graphExplorer.eyebrow")}</span><h2>{t("graphExplorer.title")}</h2><p>{t("graphExplorer.subtitle")}</p></div>
      <div className="gx-heading-actions"><button className="gx-button" aria-label={t(night ? "graphExplorer.day" : "graphExplorer.night")} onClick={() => setNight(!night)}>{night ? <Sun size={16} /> : <Moon size={16} />}</button><button className="gx-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "gx-spin" : ""} />{t("members.graphRefresh")}</button></div>
    </div>
    <div className="gx-experience">
      <div className="gx-segment" aria-label={t("graphExplorer.layout")}><button aria-pressed={!orbit} onClick={() => { setOrbit(false); reset(); }}><Sparkles size={14} />{t("graphExplorer.constellation")}</button><button aria-pressed={orbit} onClick={() => { setOrbit(true); reset(); }}><Orbit size={14} />{t("graphExplorer.orbit")}</button></div>
      <button className="gx-discover" disabled={!graph.nodes.length} onClick={() => { const pool = graph.nodes.filter(node => memberNodeKey(node) !== selected); const node = pool[Math.floor(Math.random() * pool.length)] ?? graph.nodes[0]; if (node) { reset(); setSelected(memberNodeKey(node)); setQuery(""); } }}><Compass size={16} />{t("graphExplorer.discover")}<ArrowUpRight size={14} /></button>
      <button className="gx-motion-toggle" aria-pressed={motion} title={t("graphExplorer.motionHint")} onClick={() => setMotion(!motion)}>{motion ? <Pause size={13} /> : <Play size={13} />}{t("graphExplorer.motion")}</button>
    </div>
    <div className="gx-filters">
      <label className="gx-search"><Search size={16} /><input aria-label={t("graphExplorer.search")} placeholder={t("graphExplorer.search")} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => {
        if (e.key === "Enter" && matching.size) selectNode([...matching][0]!);
      }} />{query && <button aria-label={t("graphExplorer.clearSearch")} onClick={() => setQuery("")}><X size={13} /></button>}</label>
      <div className="gx-segment" aria-label={t("graphExplorer.memberType")}>
        {(["all", "human", "agent"] as const).map((value) => <button key={value} aria-pressed={type === value} onClick={() => { setType(value); clearFocus(); }}>{t("graphExplorer." + value)}</button>)}
      </div>
      <label className="gx-check"><input type="checkbox" checked={hideIsolated} onChange={(e) => setHideIsolated(e.target.checked)} />{t("graphExplorer.connectedOnly")}</label>
      <label className="gx-min">{t("graphExplorer.minimum")}<select aria-label={t("graphExplorer.minimum")} value={minimum} onChange={(e) => setMinimum(Number(e.target.value))}><option value={1}>1+</option><option value={3}>3+</option><option value={5}>5+</option><option value={10}>10+</option></select></label>
      {filtersActive && <button className="gx-text-button" onClick={resetFilters}>{t("graphExplorer.clear")}</button>}
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
          <div className="gx-orbits" aria-hidden="true"><i /><i /><i /></div>
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label={t("members.graphAriaLabel")}>
            {graph.edges.map((item) => {
              const a = positions.get(item.sourceKey)!, b = positions.get(item.targetKey)!;
              const key = pairKey(item.sourceKey, item.targetKey);
              const active = routeStart ? routeEdges.has(key) : focus ? item.sourceKey === memberNodeKey(focus) || item.targetKey === memberNodeKey(focus) : selectedEdge === key;
              const dim = (!!connected && !active) || (!!query.trim() && !matching.has(item.sourceKey) && !matching.has(item.targetKey));
              const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1;
              const direction = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2 ? 1 : -1;
              const offsets = edgeCurveOffsets(strands ? item.weight : 1, direction, distance);
              const path = (offset: number) => `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2 - dy / distance * offset} ${(a.y + b.y) / 2 + dx / distance * offset} ${b.x} ${b.y}`;
              const middle = offsets[Math.floor(offsets.length / 2)]!;
              const labelPosition = edgeLabels.get(key)!;
              const label = `${displayName(a)} ↔ ${displayName(b)} · ${t("members.graphInteractionCount", { count: item.weight })}`;
              return <g key={key} className={`gx-edge${active ? " active" : ""}${dim ? " dim" : ""}`}>
                {offsets.map((offset, index) => <path className="gx-strand" key={index} d={path(offset)} style={!strands ? { strokeWidth: clamp(Math.log2(item.weight + 1), 1, 4) } : undefined} />)}
                {motion && <path className="gx-flow" d={path(middle)} pathLength={100} aria-hidden="true" />}
                <path className="gx-edge-hit" data-edge={key} d={path(middle)} role="button" tabIndex={0} aria-label={label} onClick={() => { clearFocus(); setSelectedEdge(key); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clearFocus(); setSelectedEdge(key); } }}><title>{label}</title></path>
                {active && <g className="gx-edge-count" transform={`translate(${labelPosition.x},${labelPosition.y})`}><rect x={-17} y={-11} width={34} height={22} rx={11} /><text textAnchor="middle" dy="4">{item.weight}</text></g>}
              </g>;
            })}
          </svg>
          {[...positions.values()].map((node) => {
            const key = memberNodeKey(node), dim = (!!connected && !connected.has(key)) || (!!query.trim() && !matching.has(key));
            return <button key={key} data-node={key} aria-pressed={selected === key || routeStart === key || routeEnd === key}
              className={`gx-node ${node.type}${node.connections ? "" : " isolated"}${dim ? " dim" : ""}${selected === key ? " selected" : ""}${query.trim() && matching.has(key) ? " match" : ""}`}
              style={{ left: node.x, top: node.y }}
              onDragStart={(event) => event.preventDefault()}
              onMouseEnter={() => setHovered(key)} onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(key)} onBlur={() => setHovered(null)}
              onClick={(event) => { if (event.detail === 0 || !suppressClick.current) selectNode(key); }}
              title={`${displayName(node)} · ${t("members.graphInteractionCount", { count: node.connections })}`}>
              <span className="gx-avatar">{avatar(node)}{node.type === "agent" && <span className={`dot ${node.status || "inactive"}`} />}{node.connections > 0 && <span className="gx-node-count" aria-hidden="true">{node.connections}</span>}</span>
              <span className="gx-node-name">{displayName(node)}</span>
            </button>;
          })}
        </div>
        {!data && !failed && <div className="gx-map-empty" role="status">{t("members.loading")}</div>}
        {data && (!graph.nodes.length || (!!query.trim() && !matching.size)) && <div className="gx-map-empty" role="status"><GitBranch size={30} /><b>{t("graphExplorer.noResults")}</b><button className="gx-button" onClick={resetFilters}>{t("graphExplorer.clear")}</button></div>}
        <div className="gx-map-bottom" data-controls>
          <div className="gx-legend"><span><i className="human" />{t("common.humans")}</span><span><i className="agent" />{t("common.agents")}</span><button aria-pressed={strands} onClick={() => setStrands(!strands)}>{t(strands ? "graphExplorer.strands" : "graphExplorer.compact")}</button></div>
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
        {routeStart && positions.has(routeStart) && (!routeEnd || positions.has(routeEnd)) ? <section className="gx-card gx-detail gx-route" aria-live="polite">
          <div className="gx-card-heading"><h3>{t("graphExplorer.pathTitle")}</h3><button aria-label={t("graphExplorer.closeDetail")} onClick={clearFocus}><X size={16} /></button></div>
          <p>{t("graphExplorer.pathFrom", { name: displayName(positions.get(routeStart)!) })}</p>
          {!routeEnd ? <p>{t("graphExplorer.pickDestination")}</p> : route ? <><div className="gx-interaction-total"><b>{route.length - 1}</b><span>{t("graphExplorer.hops")}</span></div><ol>{route.map((key) => { const node = positions.get(key)!; return <li key={key}>{avatar(node, 28)}<span>{displayName(node)}</span></li>; })}</ol></> : <p>{t("graphExplorer.noPath")}</p>}
          <p className="gx-source">{t("graphExplorer.pathHint")}</p><button className="gx-button" onClick={clearFocus}>{t("graphExplorer.exitPath")}</button>
        </section> : selectedNode ? <section className="gx-card gx-detail">
          <div className="gx-card-heading"><h3>{t("graphExplorer.memberDetail")}</h3><button aria-label={t("graphExplorer.closeDetail")} onClick={clearFocus}><X size={16} /></button></div>
          <div className="gx-person">{avatar(selectedNode, 46)}<div><h4>{displayName(selectedNode)}</h4><span>{t("graphExplorer." + selectedNode.type)}</span></div></div>
          <p>{t("graphExplorer.memberSummary", { count: collaborators.length, interactions: selectedNode.connections })}</p>
          <button className="gx-button gx-profile" onClick={() => openMember(selectedNode)}>{t("graphExplorer.profile")}<ArrowUpRight size={14} /></button>
          <button className="gx-button gx-profile" onClick={() => { setRouteStart(memberNodeKey(selectedNode)); setRouteEnd(null); setHovered(null); }}><GitBranch size={14} />{t("graphExplorer.findPath")}</button>
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
        <section className="gx-card gx-guide"><Sparkles size={20} /><h3>{t("graphExplorer.explore")}</h3><p>{t("graphExplorer.guide")}</p><p>{t("graphExplorer.motionHint")}</p><p className="gx-source">{t("graphExplorer.source")}</p></section>
        <section className="gx-card gx-channel-card"><h3>{t("members.graphLargestChannels")}</h3><div className="gx-list">{channels.map((channel) => <button key={channel.id} onClick={() => navigate(`/s/${slug}/channel/${channel.id}`)}><Hash size={14} /><span>{channel.name}</span><small>{channel.humanCount}H / {channel.agentCount}A</small><ArrowUpRight size={13} /></button>)}</div></section>
      </aside>
    </div>
  </div>;
}
