import type { CSSProperties, ReactNode } from "react";
import type { Rarity } from "@/lib/types";

// Rubber stamps: inked with the #ink-stamp filter defined in the root layout.

type StampStyle = CSSProperties & { "--tilt"?: string; "--c"?: string };

export function Stamp({
  children,
  tilt = -8,
  color,
  thump = false,
  className = "",
}: {
  children: ReactNode;
  tilt?: number;
  color?: string;
  thump?: boolean;
  className?: string;
}) {
  const style: StampStyle = { "--tilt": `${tilt}deg`, ...(color ? { "--c": color } : {}) };
  return (
    <span className={`stamp ${thump ? "stamp-thump" : ""} ${className}`} style={style}>
      {children}
    </span>
  );
}

const RARITY: Record<Rarity, { label: string; color: string; mark: string; meaning: string }> = {
  common: { label: "Common", color: "var(--color-moss-deep)", mark: "●", meaning: "A household name." },
  uncommon: { label: "Uncommon", color: "var(--color-robin-deep)", mark: "◆", meaning: "Well funded and well known in tech." },
  rare: { label: "Rare", color: "var(--color-rust)", mark: "▲", meaning: "An early-stage startup." },
  mythical: { label: "Mythical", color: "var(--color-ink)", mark: "✦", meaning: "No confirmed sightings." },
};

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const r = RARITY[rarity];
  return (
    <span className="stamp stamp-sm" style={{ "--tilt": "-3deg", "--c": r.color } as StampStyle} title={r.meaning}>
      <span aria-hidden="true">{r.mark}</span>
      <span>
        {r.label}
        <span className="sr-only">. {r.meaning}</span>
      </span>
    </span>
  );
}

/** A round postmark: "JARGON DENSITY" around the rim, the score in the middle. */
export function DensityStamp({ score }: { score: number }) {
  return (
    <svg
      viewBox="0 0 140 140"
      className="h-36 w-36 shrink-0"
      style={{ transform: "rotate(-9deg)", mixBlendMode: "multiply" }}
      role="img"
      aria-label={`Jargon density: ${score} out of 10`}
    >
      <defs>
        <path id="rim-top" d="M 24 70 A 46 46 0 0 1 116 70" />
        <path id="rim-bottom" d="M 17 70 A 53 53 0 0 0 123 70" />
      </defs>
      <g filter="url(#ink-stamp-light)" fill="none" stroke="var(--color-rust)">
        <circle cx="70" cy="70" r="66" strokeWidth="3.5" />
        <circle cx="70" cy="70" r="59" strokeWidth="1.4" />
        <circle cx="70" cy="70" r="35" strokeWidth="1.4" />
        <text fill="var(--color-rust)" stroke="none" fontFamily="var(--font-display)" fontWeight="800" fontSize="11.5" letterSpacing="2.4">
          <textPath href="#rim-top" startOffset="50%" textAnchor="middle">
            JARGON DENSITY
          </textPath>
        </text>
        <text fill="var(--color-rust)" stroke="none" fontFamily="var(--font-display)" fontWeight="700" fontSize="8.5" letterSpacing="2">
          <textPath href="#rim-bottom" startOffset="50%" textAnchor="middle">
            ★ FIELD MEASURE ★
          </textPath>
        </text>
        <text x="70" y="81" textAnchor="middle" fill="var(--color-rust)" stroke="none" fontFamily="var(--font-display)" fontWeight="800" fontSize="32">
          {score}
          <tspan fontSize="14" dx="1.5">/10</tspan>
        </text>
      </g>
    </svg>
  );
}
