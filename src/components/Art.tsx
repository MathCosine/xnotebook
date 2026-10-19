// Illustrations, the logo and notebook covers — all inline SVG so they pick up
// the theme's CSS variables. The shared #xl-wobble filter (see SvgDefs) makes
// the line art a little uneven, like it was drawn by hand.
import { useId } from "react";
import type { CoverColor } from "../lib/types";

const ink = "var(--ink)";
const paper = "var(--paper)";
const rule = "var(--rule-strong)";

export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="xl-wobble" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <rect x="4.6" y="2.8" width="21.4" height="26.4" rx="2.2" fill={paper} stroke={ink} strokeWidth="1.6" />
      <path d="M10 3.4v25.2" stroke="var(--margin)" strokeWidth="1.1" />
      <path d="M12.6 9.6h9.8M12.6 14h9.8M12.6 18.4h5.2" stroke={rule} strokeWidth="1.1" strokeLinecap="round" />
      {[7.6, 16, 24.4].map((cy) => (
        <circle key={cy} cx="7.3" cy={cy} r="1.05" fill="var(--desk)" stroke={ink} strokeWidth=".9" />
      ))}
      <path
        d="M17.6 18.2c2.8 2.6 5.6 6 8.6 9.9M27.4 17.6c-3.4 2.9-6.1 6.2-8.9 10.4"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export const COVER_HEX: Record<CoverColor, string> = {
  ink: "#26324d",
  oxblood: "#7b2f2c",
  forest: "#2f5b44",
  ochre: "#b27b24",
  cobalt: "#2d4f9e",
  graphite: "#3e4046",
  teal: "#1f6a6b",
  plum: "#5e3b63",
};

function seedFrom(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return h;
}

/** A composition-book cover with its own marbling, seeded by the notebook id. */
export function NotebookCover({ color, seed, width = 30, label = true }: { color: CoverColor; seed: string; width?: number; label?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const hex = COVER_HEX[color];
  return (
    <svg width={width} height={(width * 52) / 40} viewBox="0 0 40 52" aria-hidden="true" className="cover">
      <defs>
        <filter id={`m${uid}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.16 0.12" numOctaves="3" seed={seedFrom(seed)} result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  15 0 0 0 -7.4" result="spots" />
          <feComposite in="spots" in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <rect x="2" y="1.5" width="36" height="49" rx="2.6" fill={hex} />
      <rect x="2" y="1.5" width="36" height="49" rx="2.6" fill="#fff" opacity=".5" filter={`url(#m${uid})`} />
      <path d="M2 4.1a2.6 2.6 0 0 1 2.6-2.6H9v49H4.6A2.6 2.6 0 0 1 2 47.9z" fill={hex} />
      <path d="M9 1.5v49" stroke="rgba(0,0,0,.28)" strokeWidth="1" />
      {label && (
        <>
          <rect x="15" y="13" width="18" height="12" rx="1.6" fill="#fbf8f1" stroke="rgba(0,0,0,.45)" strokeWidth=".8" />
          <path d="M18 18h12M18 21.4h8" stroke="#c9d3e0" strokeWidth=".9" />
        </>
      )}
      <rect x="2" y="1.5" width="36" height="49" rx="2.6" fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="1" />
    </svg>
  );
}

/** Welcome: a stack of notebooks, a pencil, coffee, a loose sheet. */
export function DeskArt() {
  return (
    <svg viewBox="0 0 320 200" className="art" role="img" aria-label="A stack of notebooks, a pencil and a mug of coffee">
      <g filter="url(#xl-wobble)" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="166" cy="182" rx="128" ry="9" fill="var(--shadow)" />
        {/* loose sheet */}
        <g transform="rotate(-9 52 166)">
          <rect x="22" y="142" width="64" height="44" rx="2" fill={paper} stroke={ink} strokeWidth="1.8" />
          <path d="M33 143v42" stroke="var(--margin)" strokeWidth="1.2" />
          <path d="M38 154h40M38 162h40M38 170h28" stroke={rule} strokeWidth="1.2" />
          <circle cx="27.5" cy="152" r="1.6" fill="var(--desk)" stroke={ink} />
          <circle cx="27.5" cy="176" r="1.6" fill="var(--desk)" stroke={ink} />
          <path d="M66 165c3 3 6 6.6 9 10.6M76 164c-4 3.3-6.8 7-9.6 11.6" stroke="var(--accent)" strokeWidth="2.6" fill="none" />
        </g>
        {/* bottom book */}
        <g transform="rotate(-1.5 160 156)">
          <rect x="74" y="142" width="180" height="30" rx="4" fill={COVER_HEX.oxblood} stroke={ink} strokeWidth="2" />
          <rect x="80" y="147" width="170" height="20" rx="1.5" fill={paper} stroke={ink} strokeWidth="1.2" />
          <path d="M84 152h162M84 157h162M84 162h162" stroke={rule} strokeWidth="1" />
        </g>
        {/* middle book */}
        <g transform="rotate(2.6 168 128)">
          <rect x="88" y="116" width="162" height="26" rx="4" fill={COVER_HEX.forest} stroke={ink} strokeWidth="2" />
          <rect x="93" y="121" width="152" height="16" rx="1.5" fill={paper} stroke={ink} strokeWidth="1.2" />
          <path d="M97 126h144M97 131.5h144" stroke={rule} strokeWidth="1" />
        </g>
        {/* top book */}
        <g transform="rotate(-3.5 166 104)">
          <rect x="98" y="92" width="144" height="24" rx="4" fill={COVER_HEX.cobalt} stroke={ink} strokeWidth="2" />
          <rect x="103" y="97" width="134" height="14" rx="1.5" fill={paper} stroke={ink} strokeWidth="1.2" />
          <path d="M107 102h126M107 106.5h126" stroke={rule} strokeWidth="1" />
          <rect x="118" y="88" width="9" height="16" fill="var(--accent)" stroke={ink} strokeWidth="1.4" />
        </g>
        {/* pencil */}
        <g transform="rotate(-11 160 78)">
          <path d="M104 72h108v11H104z" fill="var(--tab-mustard)" stroke={ink} strokeWidth="1.8" />
          <path d="M104 77.5h108" stroke={ink} strokeWidth=".9" opacity=".35" />
          <path d="M212 72h10v11h-10z" fill="var(--tab-slate)" stroke={ink} strokeWidth="1.6" />
          <path d="M222 72h9a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-9z" fill="var(--tab-rose)" stroke={ink} strokeWidth="1.6" />
          <path d="M104 72l-17 5.5 17 5.5z" fill="#e9cfa6" stroke={ink} strokeWidth="1.6" />
          <path d="M91.6 76l-4.6 1.5 4.6 1.5z" fill={ink} />
        </g>
        {/* mug */}
        <path d="M262 120h36v42a8 8 0 0 1-8 8h-20a8 8 0 0 1-8-8z" fill="var(--paper-2)" stroke={ink} strokeWidth="2" />
        <path d="M298 130h4a8 8 0 0 1 0 16h-4" fill="none" stroke={ink} strokeWidth="2" />
        <path d="M262 132h36" stroke={ink} strokeWidth="1" opacity=".3" />
        <path d="M272 108c-4-5 4-8 0-14M282 106c-4-5 4-8 0-14M291 109c-3-4 3-7 0-11" fill="none" stroke="var(--ink-3)" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

/** Empty notebook: an open spiral notebook with cards flying in. */
export function OpenNotebookArt() {
  const lines = [70, 84, 98, 112, 126, 140];
  return (
    <svg viewBox="0 0 300 196" className="art" role="img" aria-label="An open notebook waiting for notes">
      <g filter="url(#xl-wobble)" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="150" cy="178" rx="122" ry="8" fill="var(--shadow)" />
        <path d="M150 44c-36-10-78-8-116 2v118c38-9 80-11 116-1z" fill={paper} stroke={ink} strokeWidth="2" />
        <path d="M150 44c36-10 78-8 116 2v118c-38-9-80-11-116-1z" fill={paper} stroke={ink} strokeWidth="2" />
        <path d="M58 47.5v112" stroke="var(--margin)" strokeWidth="1.2" />
        {lines.map((y) => (
          <g key={y}>
            <path d={`M40 ${y + 1}c34-6 70-7 104-3`} stroke={rule} strokeWidth="1" fill="none" />
            <path d={`M156 ${y - 2}c34-4 70-3 104 3`} stroke={rule} strokeWidth="1" fill="none" />
          </g>
        ))}
        <path d="M64 79c5-3 9 2 14-1s9 1 14-1 9 2 14-1M64 93c5-3 9 2 14-1s9 1 14-1M64 107c5-3 9 2 14-1s9 1 14-1 9 2 14-1 9 1 14-1" fill="none" stroke="var(--ink-2)" strokeWidth="1.5" />
        <rect x="164" y="88" width="62" height="9" rx="2" fill="var(--hl)" opacity=".9" />
        <path d="M168 94c5-3 9 2 14-1s9 1 14-1 9 2 14-1 9 1 12 0" fill="none" stroke="var(--ink-2)" strokeWidth="1.5" />
        {[54, 68, 82, 96, 110, 124, 138, 152].map((y) => (
          <ellipse key={y} cx="150" cy={y} rx="5" ry="2.8" fill="none" stroke={ink} strokeWidth="1.5" />
        ))}
        {/* cards flying in */}
        <g transform="rotate(14 250 30)">
          <rect x="226" y="14" width="46" height="30" rx="2" fill={paper} stroke={ink} strokeWidth="1.7" />
          <path d="M226 21h46" stroke="var(--margin)" strokeWidth="1" />
          <path d="M232 29h30M232 36h20" stroke={rule} strokeWidth="1" />
        </g>
        <g transform="rotate(-8 196 18)">
          <rect x="178" y="4" width="38" height="24" rx="2" fill="var(--tab-sky)" stroke={ink} strokeWidth="1.7" />
          <path d="M184 13h24M184 19h16" stroke={ink} strokeWidth="1" opacity=".4" />
        </g>
        <path d="M282 56c-6 6-14 10-24 12M270 70c-8 3-16 4-24 3M224 38c-6 3-12 5-20 5" fill="none" stroke="var(--ink-3)" strokeWidth="1.4" strokeDasharray="2 5" />
        {/* pencil */}
        <g transform="rotate(-28 220 150)">
          <path d="M186 146h72v9h-72z" fill="var(--tab-mustard)" stroke={ink} strokeWidth="1.6" />
          <path d="M258 146h9a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-9z" fill="var(--tab-rose)" stroke={ink} strokeWidth="1.5" />
          <path d="M186 146l-13 4.5 13 4.5z" fill="#e9cfa6" stroke={ink} strokeWidth="1.5" />
          <path d="M176.6 149.3l-3.6 1.2 3.6 1.2z" fill={ink} />
        </g>
      </g>
    </svg>
  );
}

/** Loose leaf is empty: a clipped sheet with a big tick. */
export function AllFiledArt() {
  return (
    <svg viewBox="0 0 140 100" className="art art-sm" role="img" aria-label="Everything's filed">
      <g filter="url(#xl-wobble)" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="70" cy="92" rx="46" ry="4" fill="var(--shadow)" />
        <g transform="rotate(-5 70 52)">
          <rect x="38" y="16" width="64" height="72" rx="2" fill={paper} stroke={ink} strokeWidth="1.8" />
          <path d="M50 17v70" stroke="var(--margin)" strokeWidth="1.1" />
          <path d="M55 32h38M55 44h38M55 56h38M55 68h24" stroke={rule} strokeWidth="1.1" />
          <path d="M58 52l11 12 22-28" fill="none" stroke="var(--accent)" strokeWidth="4" />
        </g>
        <path d="M84 6v24a6 6 0 0 1-12 0V12a4 4 0 0 1 8 0v16" fill="none" stroke="var(--ink-2)" strokeWidth="2" />
      </g>
    </svg>
  );
}

/** Search found nothing: a magnifier over a blank card. */
export function NothingFoundArt() {
  return (
    <svg viewBox="0 0 140 100" className="art art-sm" role="img" aria-label="Nothing found">
      <g filter="url(#xl-wobble)" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="70" cy="92" rx="46" ry="4" fill="var(--shadow)" />
        <g transform="rotate(4 64 50)">
          <rect x="26" y="22" width="76" height="52" rx="2" fill={paper} stroke={ink} strokeWidth="1.8" />
          <path d="M26 32h76" stroke="var(--margin)" strokeWidth="1.1" />
          <path d="M34 44h44M34 54h30M34 64h38" stroke={rule} strokeWidth="1.1" />
        </g>
        <circle cx="92" cy="56" r="16" fill="var(--paper-2)" fillOpacity=".55" stroke={ink} strokeWidth="2.4" />
        <path d="M104 68l14 14" stroke={ink} strokeWidth="5" />
        <path d="M86 50c1-4 7-5 9-1 2 3-3 5-3 8M92 63v.5" fill="none" stroke="var(--accent)" strokeWidth="2.2" />
      </g>
    </svg>
  );
}

/** Small sketches for the three "how it works" steps. */
export function StepArt({ step }: { step: 1 | 2 | 3 }) {
  return (
    <svg viewBox="0 0 64 48" className="step-art" aria-hidden="true">
      <g filter="url(#xl-wobble)" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke={ink} strokeWidth="1.7">
        {step === 1 && (
          <>
            <rect x="8" y="10" width="40" height="28" rx="2" fill={paper} />
            <path d="M14 20c4-2 7 1 10-1s6 1 10-1M14 28c4-2 7 1 10-1" stroke="var(--ink-2)" />
            <path d="M42 36l14-16 3 3-14 16-5 1z" fill="var(--tab-mustard)" />
          </>
        )}
        {step === 2 && (
          <>
            <rect x="10" y="26" width="44" height="16" rx="2" fill="var(--tab-sage)" />
            <path d="M16 26v-6h10l2 3h20v3" fill="var(--tab-sky)" />
            <rect x="22" y="4" width="20" height="13" rx="1.5" fill={paper} transform="rotate(10 32 10)" />
            <path d="M32 18v8M28.5 22.5L32 26l3.5-3.5" stroke="var(--accent)" />
          </>
        )}
        {step === 3 && (
          <>
            <path d="M8 40V12l6-4h6l2 4h34v28z" fill="var(--tab-clay)" />
            <path d="M8 16h48" />
            <rect x="14" y="20" width="36" height="16" fill={paper} />
            <path d="M18 26h20M18 31h12" stroke={rule} />
            <rect x="17" y="24" width="18" height="4" fill="var(--hl)" stroke="none" />
          </>
        )}
      </g>
    </svg>
  );
}
