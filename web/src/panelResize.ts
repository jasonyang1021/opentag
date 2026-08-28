export const MIN_PANEL_WIDTH = 180;
export const MAX_SIDEBAR_WIDTH = 560;
export const MIN_CHAT_WIDTH = 280;
export const RAIL_WIDTH = 56;

export function resizedPanelWidth(
  which: "sb" | "traj",
  currentWidth: number,
  delta: number,
  viewportWidth: number,
  sidebarWidth: number,
): number {
  const maxWidth = which === "sb"
    ? MAX_SIDEBAR_WIDTH
    : Math.max(MIN_PANEL_WIDTH, viewportWidth - RAIL_WIDTH - sidebarWidth - MIN_CHAT_WIDTH);
  return Math.max(MIN_PANEL_WIDTH, Math.min(maxWidth, currentWidth + delta));
}
