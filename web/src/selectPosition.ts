export function selectPosition(r: { left: number; top: number; bottom: number; width: number }, width: number, height: number) {
  const gap = 6, margin = 8;
  const below = Math.max(0, height - r.bottom - gap - margin), above = Math.max(0, r.top - gap - margin);
  const up = below < 280 && above > below;
  return { left: Math.max(margin, Math.min(r.left, width - r.width - margin)),
    width: Math.max(0, Math.min(r.width, width - margin * 2)),
    ...(up ? { bottom: height - r.top + gap } : { top: r.bottom + gap }),
    maxHeight: Math.min(280, up ? above : below) };
}
