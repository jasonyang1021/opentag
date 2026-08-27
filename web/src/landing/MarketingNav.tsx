import { Link } from "react-router-dom";
import {
  PUBLIC_BRAND_MARK_SRC,
  PUBLIC_NAV_LINKS,
  type PublicNavLinkKey,
  resolvePublicNavHref,
} from "./publicNav.ts";

type MarketingNavProps = {
  variant: "landing" | "features";
  labels?: Partial<Record<PublicNavLinkKey, string>>;
  enterLabel: string;
  onEnterWorkspace: () => void;
  languageToggle?: {
    label: string;
    text: string;
    onClick: () => void;
  };
};

type PublicBrandProps = {
  href?: string;
  className?: string;
};

function PublicBrandContent() {
  return (
    <>
      <img className="lp-brand-mark" src={PUBLIC_BRAND_MARK_SRC} alt="" width={34} height={34} />
      <span className="lp-brand-word">opentag</span>
    </>
  );
}

export function PublicBrand({ href, className = "" }: PublicBrandProps) {
  const classes = ["lp-brand", className].filter(Boolean).join(" ");
  if (href) return <a className={classes} href={href} aria-label="open-tag home"><PublicBrandContent /></a>;
  return <div className={classes}><PublicBrandContent /></div>;
}

// Shared public-site header for landing and feature pages. Docs imports the same
// publicNav contract from Astro so top-level links and brand assets do not drift.
export function MarketingNav({
  variant,
  labels = {},
  enterLabel,
  onEnterWorkspace,
  languageToggle,
}: MarketingNavProps) {
  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : undefined;

  return (
    <header className="lp-nav">
      <div className="lp-container lp-nav__inner">
        {variant === "landing" ? (
          <PublicBrand href="#top" />
        ) : (
          <Link className="lp-brand" to="/" aria-label="open-tag home">
            <PublicBrandContent />
          </Link>
        )}
        <nav className="lp-nav__links" aria-label="Main navigation">
          {PUBLIC_NAV_LINKS.map((link) => (
            <a key={link.key} href={resolvePublicNavHref(link, origin, "marketing")}>
              {labels[link.key] ?? link.label}
            </a>
          ))}
        </nav>
        <div className="lp-nav__cta">
          {languageToggle && (
            <button className="lp-btn lp-btn--ghost lp-btn--sm" type="button" onClick={languageToggle.onClick} aria-label={languageToggle.label}>
              {languageToggle.text}
            </button>
          )}
          <button className="lp-btn lp-btn--primary lp-btn--sm" onClick={onEnterWorkspace}>{enterLabel}</button>
        </div>
      </div>
    </header>
  );
}
