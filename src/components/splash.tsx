/**
 * Opening animation: a house being built (ground, walls, roof, lights) and
 * the name — about a second and a half, once per app opening (not on every
 * page). Pure CSS: shown before anything loads, gone without JavaScript.
 */
export function Splash() {
  return (
    <>
      {/* seen in this tab already → no animation on reloads / back from a link */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem("sf-splash"))document.documentElement.classList.add("sf-seen");else sessionStorage.setItem("sf-splash","1")}catch(e){}`,
        }}
      />
      <div className="sf-splash" aria-hidden="true">
        <svg viewBox="0 0 120 120" className="sf-house">
          <line className="sf-ground" x1="10" y1="100" x2="110" y2="100" />
          <g className="sf-walls">
            <rect x="28" y="56" width="64" height="44" rx="2" />
          </g>
          <polygon className="sf-roof" points="20,58 60,24 100,58" />
          <rect className="sf-door" x="52" y="76" width="16" height="24" rx="2" />
          <rect className="sf-window sf-w1" x="34" y="66" width="12" height="12" rx="1.5" />
          <rect className="sf-window sf-w2" x="74" y="66" width="12" height="12" rx="1.5" />
          <line className="sf-crane" x1="104" y1="100" x2="104" y2="18" />
          <line className="sf-crane sf-jib" x1="104" y1="18" x2="66" y2="18" />
        </svg>
        <span className="sf-name">SiteFlow</span>
      </div>
    </>
  );
}
