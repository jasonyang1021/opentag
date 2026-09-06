/** Local, versioned SVG avatars. No names or other user input enter SVG markup. */
export type AvatarKind = "animal" | "robot";
const palettes = [
  ["#FFE2CC", "#ED9360", "#FFF5DE"], ["#D9EDE6", "#68AD9B", "#F3FAE9"],
  ["#E8DFFA", "#AD91D0", "#FFF2ED"], ["#D9ECFA", "#77A9D2", "#F5FAFF"],
  ["#F8DFE6", "#D78DA5", "#FFF3E7"], ["#F5EBC7", "#CAA954", "#FFFAE6"],
];
export function avatarHash(seed: string): number {
  let hash = 2166136261;
  for (const point of seed.normalize("NFC")) hash = Math.imul(hash ^ point.codePointAt(0)!, 16777619);
  return hash >>> 0;
}
export function generatedChoice(url?: string | null): { kind: AvatarKind; seed: string } | null {
  const match = /^tagora:v1:(animal|robot):(.*)$/s.exec(url || "");
  return match ? { kind: match[1] as AvatarKind, seed: match[2]! } : null;
}
export function colorAvatarSvg(seed: string, kind: AvatarKind): string {
  const hash = avatarHash(seed || "?");
  const [bg, coat, cream] = palettes[hash % palettes.length]!;
  const ink = "#34334B";
  const variant = Math.floor(hash / palettes.length) % 6;
  const cheeks = `<g fill="#ED8F91" opacity=".65"><ellipse cx="20" cy="42" rx="4" ry="2.5"/><ellipse cx="44" cy="42" rx="4" ry="2.5"/></g>`;
  const eyes = `<g fill="${ink}" stroke="none"><ellipse cx="23" cy="34" rx="2.2" ry="2.8"/><ellipse cx="41" cy="34" rx="2.2" ry="2.8"/></g>`;
  let face: string;
  if (kind === "robot") {
    face = `<path d="M32 17V10"/><circle cx="32" cy="8" r="3.5" fill="${coat}"/>
      <rect x="9" y="28" width="7" height="15" rx="3" fill="${coat}"/><rect x="48" y="28" width="7" height="15" rx="3" fill="${coat}"/>
      <rect x="14" y="17" width="36" height="36" rx="${[12, 9, 16][variant % 3]}" fill="${coat}"/>
      <rect x="19" y="24" width="26" height="21" rx="8" fill="${ink}" stroke="none"/>
      <g stroke="${cream}" stroke-width="3" stroke-linecap="round">${variant % 2 ? '<path d="M24 32l2-2 2 2m8 0 2-2 2 2"/>' : '<path d="M26 30v4m12-4v4"/>'}<path d="M29 39q3 3 6 0"/></g>
      <path d="M28 49h8" stroke="${cream}"/><circle cx="47" cy="21" r="2" fill="${cream}" stroke="none"/>`;
  } else {
    // Fox, cat, bear, panda, otter and penguin — silhouettes remain readable at 20px.
    const ears = variant < 2 ? `<path d="M14 29L13 10l16 13M35 23l16-13-1 19" fill="${coat}"/><path d="M17 23l-1-8 7 7m18 0 7-7-1 8" stroke="${cream}" stroke-width="3"/>`
      : variant < 5 ? `<circle cx="16" cy="22" r="8" fill="${variant === 3 ? ink : coat}"/><circle cx="48" cy="22" r="8" fill="${variant === 3 ? ink : coat}"/>` : "";
    face = `${ears}<path d="M12 36c0-13 8-20 20-20s20 7 20 20c0 14-8 20-20 20S12 50 12 36Z" fill="${variant === 3 ? cream : variant === 5 ? ink : coat}"/>
      ${variant === 0 ? `<path d="M13 32l19 8 19-8c1 15-8 22-19 22S12 47 13 32" fill="${cream}" stroke="none"/>` : variant === 5 ? `<path d="M17 36c0-17 15-13 15-6 0-7 15-11 15 6 0 12-6 17-15 17s-15-5-15-17" fill="${cream}" stroke="none"/>` : `<ellipse cx="32" cy="43" rx="${variant === 4 ? 15 : 12}" ry="10" fill="${cream}" stroke="none"/>`}
      ${variant === 3 ? `<g fill="${ink}" stroke="none"><ellipse cx="23" cy="33" rx="6" ry="7" transform="rotate(25 23 33)"/><ellipse cx="41" cy="33" rx="6" ry="7" transform="rotate(-25 41 33)"/></g><g fill="${cream}" stroke="none"><circle cx="23" cy="33" r="2"/><circle cx="41" cy="33" r="2"/></g>` : eyes}
      ${cheeks}<path d="M29 40q3-2 6 0l-3 3Z" fill="${variant === 5 ? "#F3B64E" : ink}" stroke="none"/><path d="M32 43v2m-5 0q5 5 10 0" fill="none" stroke-width="1.6"/>
      ${variant === 1 ? '<path d="M12 38l6 1m-6 5 6-1m28-4 6-1m-6 5 6 1M28 19l1 5m6-5-1 5" fill="none" stroke-width="1.5"/>' : ""}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${bg}"/><circle cx="51" cy="12" r="3" fill="white" opacity=".65"/><path d="M8 49l2-2m-2 0 2 2" stroke="white" stroke-width="2" stroke-linecap="round"/><g stroke="${ink}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${face}</g></svg>`;
}
export function colorAvatarUri(seed: string, kind: AvatarKind): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(colorAvatarSvg(seed, kind));
}
