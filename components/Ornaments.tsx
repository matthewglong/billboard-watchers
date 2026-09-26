// Hand-drawn ornaments for the field guide. All inline SVG, all decorative.

const INK = "#1d2a24";
const MOSS = "#4f6b35";
const MOSS_DEEP = "#3a5226";
const RUST = "#a3411c";
const ROBIN = "#9fd6d1";
const ROBIN_DEEP = "#1f5e5b";
const PAPER = "#f8f2df";
const PENCIL = "#5a584b";

/** The cover illustration: a small bird perched on a billboard, calling. */
export function BirdOnBillboard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 150" className={className} aria-hidden="true">
      <path d="M6 146 q60 -3 120 0 t110 0" fill="none" stroke={PENCIL} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M62 118 v27 M162 118 v27" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M26 125 h172" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M40 125 v-4 M70 125 v-4 M100 125 v-4 M130 125 v-4 M160 125 v-4 M190 125 v-4" stroke={INK} strokeWidth="1.5" />
      <rect x="24" y="40" width="176" height="78" rx="3" fill={PAPER} stroke={INK} strokeWidth="2.6" />
      <path d="M40 62 h88" stroke={MOSS} strokeWidth="7.5" strokeLinecap="round" />
      <path d="M40 81 h112 M40 96 h66" stroke={INK} strokeWidth="3.4" strokeLinecap="round" opacity="0.85" />
      <circle cx="175" cy="68" r="11" fill={ROBIN} stroke={INK} strokeWidth="1.8" />
      <g transform="translate(142 40) scale(1.2)">
        <path d="M13 -12 L28 -19 L25 -9 Z" fill={MOSS_DEEP} />
        <ellipse cx="0" cy="-11" rx="15" ry="11" fill={MOSS} />
        <ellipse cx="-6" cy="-6.5" rx="8" ry="4.6" fill={PAPER} opacity="0.35" />
        <path d="M-5 -14 C 3 -21, 13 -17, 15 -9 C 7 -8, 0 -9, -5 -14 Z" fill={MOSS_DEEP} />
        <circle cx="-13" cy="-22" r="8" fill={MOSS} />
        <path d="M-20.5 -23.8 L-28.5 -21.6 L-20.5 -19.6 Z" fill={RUST} />
        <circle cx="-15.2" cy="-24" r="1.7" fill={INK} />
        <path d="M-4 -1 l-1.2 3.6 M4 -1 l1.2 3.6" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M-33 -28 q-3.5 5 0 10 M-38 -31 q-5 8 0 16 M-43 -34 q-6.5 11 0 22"
          fill="none"
          stroke={ROBIN_DEEP}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function Footprint({ x, y }: { x: number; y: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) rotate(90)`}
      d="M0 0 L-3 -5.8 M0 0 L0 -7 M0 0 L3 -5.8 M0 0 L0 3.4"
      stroke={PENCIL}
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  );
}

/** A pencil line with a trail of bird tracks walking across it. */
export function TrackDivider({ className = "" }: { className?: string }) {
  const line = (flip: boolean) => (
    <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="h-2 flex-1" aria-hidden="true">
      <path
        d={flip ? "M0 2.8 C 18 4.2, 30 1.6, 48 3 S 80 4.4, 100 3" : "M0 3 C 12 1.6, 24 4.4, 40 3 S 70 1.8, 100 3.1"}
        fill="none"
        stroke={PENCIL}
        strokeWidth="1.3"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity="0.7"
      />
    </svg>
  );
  return (
    <div className={`flex items-center gap-3 ${className}`} role="presentation">
      {line(false)}
      <svg viewBox="0 0 64 22" className="h-5 w-14 shrink-0" aria-hidden="true">
        <Footprint x={8} y={7} />
        <Footprint x={22} y={15} />
        <Footprint x={36} y={7} />
        <Footprint x={50} y={15} />
      </svg>
      {line(true)}
    </div>
  );
}

export function CameraIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.6" />
    </svg>
  );
}

export function PhotosIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
      <circle cx="15.5" cy="9.5" r="1.4" />
    </svg>
  );
}

export function CheckBox({ checked = true }: { checked?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" aria-hidden="true">
      <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke={INK} strokeWidth="1.6" />
      {checked && <path d="M5 10.5 l3.4 3.6 L16 4.5" fill="none" stroke={MOSS_DEEP} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
